# Relay — P2 Design Notebook

## What this document

Relay addresses a specific handoff problem: a procedure can remain polished
and plausible after the information behind it has changed. The MVP connects
repeatable **Playbooks** to shared **Context Notes**. A wording correction stays
quiet. A meaningful change preserves its before/after text and asks an officer
to review every affected active Playbook.

The room-renewal policy used in the demo is fictional. It illustrates the
workflow; it is not a statement about current MIT policy.

## Initial implementation plan

The implementation was divided into assessable increments. First, translate
and format-check the four concept specifications. Second, implement and test
each concept independently against an isolated MongoDB database. Third, connect
meaningful Context changes to Reviews through composition reactions and test
the cross-concept invariants, including concurrency. Fourth, add the trusted
local identity boundary, private Officer provisioning, and authorized HTTP
endpoints. Fifth, build the smallest Vue interface that completes the journey
without reloads. Finally, run the journey through the real browser, test its
failure paths and narrow layout, and reconcile the code, specifications,
generated contracts, and design record. Each increment had to pass its focused
tests and static checks before the next depended on it.

## The implemented journey

A newly elected student-club officer starts with a clean, host-provisioned
workspace and records two inherited procedures as Playbooks:

- **Plan the Annual Club Showcase**
- **Renew Club Room Access**

Both depend on one Context Note saying that room access is renewed annually.
The officer creates their ordered Steps and attaches the note to the relevant
Step in each Playbook. Fixing a
typo with **Correct wording** changes the text but creates no Review. Changing
the policy from annual to semester renewal with **Meaningful change** preserves
the exact old and new text and creates two Reviews. The officer verifies one
Playbook and confirms only that Review; the other remains pending. Completed
Review history remains visible after reload.

That short path exercises Relay's central claim: one change is recorded once,
but every active procedure that relied on the old information becomes visible.
Relay does not rewrite procedures or decide that they are wrong. It preserves
the reason for reconsideration and leaves the judgment to the officer.

## P2 boundary

The MVP has one host-configured workspace, one host-configured Officer, and
four implemented concepts. It includes Playbook archiving; archiving is not a
deferred feature. Member questions, multiple clubs, general registration,
multi-user authentication, invitations, and complete editing and Review
resolution workflows remain P3 work.

The browser sign-in is a local demonstration boundary, not production
authentication. A shared host credential is exchanged for an in-memory session
cookie. The API binds only to `127.0.0.1`.

## Architecture at a glance

```text
Browser
  Vue views ──typed events──> App.vue coordinator ──HTTP──> local Bun host
                                                            │
                                               session, CSRF, identity,
                                               workspace and authorization
                                                            │
                                                            ▼
                                                     Relay composition
                          ┌─────────────────┬────────────────┼────────────────┐
                          ▼                 ▼                ▼                ▼
                ProcedureMaintaining ContextTracking    Reviewing   RoleBasedAccessing
                          │                 │                │                │
                          └─────────────────┴──── reactions ─┴────────────────┘
                                                            │
                                                            ▼
                                                         MongoDB
```

Each concept owns its rules and storage. Concepts neither call one another nor
read one another's collections. The composition connects identities and reacts
to successful actions. The host, not the browser, establishes who the caller is
and which workspace is in scope.

The frontend follows the same ownership rule. `App.vue` owns session state,
navigation, server-backed workspace state, messages, and API operations.
Overview, Playbooks, Shared Context, and Reviews are typed presentation
components with feature-local form drafts. They receive data through props and
report intent through events. There is no second server-state store.

## Concept responsibilities

### ProcedureMaintaining

Owns Procedures, their ordered Steps, removal, and retirement. Step positions
are updated transactionally. Removed Steps retain stable identities so other
concepts can continue referring to them. Retiring a Procedure preserves its
Steps, Context attachments, and Review history.

### ContextTracking

Owns Context Notes, attachments, and meaningful Change records. `correct`
updates wording without creating a Change. `change` records the exact before
and after text in the same transaction that updates the note. A unique compound
index prevents duplicate attachments, including concurrent attempts.

### Reviewing

Owns Review state and Causes without knowing that an Item is a Procedure or a
Cause is a Context Change. A partial unique MongoDB index permits at most one
unfinished Review per Item. Atomic Cause updates retain distinct reasons and
reject duplicates. Conditional lifecycle updates prevent incompatible
transitions from both succeeding.

### RoleBasedAccessing

Owns Roles, Permissions, Assignments, and authorization decisions. It answers
whether an already established User may perform a Command for a Resource. It
does not authenticate requests. Role creation, permission grants, and
assignments are private provisioning operations, not public routes.

## The difficult integration decision

### The failure

The first composed concurrency test submitted four distinct meaningful Context
changes. One run retained only three Causes in the unfinished Review. The
individual concepts were correct: Change history was complete and Reviewing
still enforced one unfinished Review. The missing Cause appeared in the space
between them, where concurrent reaction flows could observe different Review
states before their ordinary work had settled.

This failure mattered more than a duplicate notification. A missing Cause could
let an officer confirm a Review without seeing every information change that
prompted it.

### The refinement

The add-Cause reaction now queries after the triggering flow's ordinary work
settles with `afterFlowSettles()`. It also checks that the Cause is not already
present. Reviewing's database constraint remains the authority for unfinished
Review uniqueness; the reaction does not try to reproduce that rule.

A separate recovery reaction handles the race in which two requests both try
to create the first Review. The database accepts one and returns
`REQUEST_ALREADY_UNFINISHED` for the other; recovery adds the refused request's
Cause to the Review that won.

```text
ContextTracking.change succeeds
          │
          ├── active Procedure has no unfinished Review ──> Reviewing.request
          │                                                    │
          │                                  already exists ───┘
          │                                         │
          │                                         ▼
          │                                recovery: add Cause
          │
          └── unfinished Review exists ─────────────> add distinct Cause
```

### The evidence

Two tests cover different schedules instead of asking one nondeterministic test
to prove both:

- Four concurrent Context changes must produce one unfinished Review containing
  four distinct Causes. This composed journey ran successfully ten times.
- Two concurrent `Reviewing.request` actions for one Item deterministically
  exercise the database refusal path. Exactly one request succeeds, exactly one
  returns `REQUEST_ALREADY_UNFINISHED`, and recovery leaves both Causes in the
  single Review. This test also ran successfully ten times.

`afterFlowSettles()` waits for tracked ordinary work in the triggering flow; it
does not serialize every independent request. These tests support the schedules
they exercise. Relay does not claim exactly-once Cause delivery across arbitrary
process crashes or every possible lifecycle race.

## Security boundary

Sync-engine authorization requires a trustworthy identity but does not create
one. The local host therefore establishes identity before invoking protected
composition endpoints:

1. Startup validates the configured workspace, Officer identity, MongoDB URL,
   and access credential.
2. Private provisioning creates or verifies the Officer Role, its three MVP
   permissions, and the assignment to the configured workspace.
3. `/session` compares the local credential and issues an expiring in-memory
   session, an HttpOnly/SameSite=Strict cookie, and a CSRF token.
4. Protected mutation routes require the session, the exact local Origin, and
   the CSRF token.
5. The host overwrites caller-supplied User and workspace fields. Authorization
   runs against the configured identities, and resource ownership is checked
   on the server.

Unknown and foreign-workspace records both produce `NOT_FOUND`, avoiding an
existence oracle. Role administration and bootstrap actions have no public
routes. The Vite bundle receives no credential, and `.env` remains ignored.

The boundary is intentionally narrow. Anyone who obtains the shared credential
can act as the configured Officer. Sessions disappear when the host restarts.
There is no TLS, identity provider, persistent session store, credential
recovery, or production-grade rate limiting.

## Interface and reactivity

Every successful create, attach, correct, change, archive, or confirm operation
refreshes server-backed Vue state without reloading the page. One mutation may
run at a time. Refreshes carry a monotonically increasing sequence, so an older
response cannot overwrite newer state.

The browser validates obvious errors early, while the server and concepts stay
authoritative. The tested failures include blank and oversized text, unavailable
attachment targets, duplicate attachments, unchanged meaningful changes,
repeated Review confirmation, foreign-workspace access, missing or expired
sessions, CSRF mismatch, cross-origin requests, and forged identity fields.

Desktop and 390-pixel walkthroughs exposed one concrete responsive defect: the
sidebar footer disappeared on narrow screens, taking Sign out with it. A compact
Sign out control was added to the mobile top bar. The verified narrow viewport
had no horizontal overflow and retained its fixed bottom navigation.

## Incremental engineering record

### October 10 — Environment and repository structure

P1 design material was separated from MVP implementation work. Sync-engine
starter files were generated in a temporary empty directory and then reviewed
before integration into the existing repository. MongoDB was placed on port
27018 to avoid another local database, then configured as a single-node replica
set so Step reordering and meaningful Context changes could use transactions.

Evidence: the database reported PRIMARY status, a two-collection transaction
committed, and the initial design checks passed.

### October 11 — Formal design and independent concepts

The four P1 concepts were converted to sync-engine specifications with explicit
success and refusal cases. Application types connect identities rather than
state: a Context Subject is a Procedure, an Anchor is a Step, a Review Item is a
Procedure, and a Cause is a Context Change.

Implementation proceeded one concept at a time:

- ProcedureMaintaining: transactional Step ordering and stable removed-Step
  identities.
- ContextTracking: transactional before/after history and unique attachments.
- Reviewing: one unfinished Review per Item and atomic Cause accumulation.
- RoleBasedAccessing: workspace-scoped permission checks and private role state.

The test suite grew from 12 tests after ProcedureMaintaining, to 23 after
ContextTracking, 37 after Reviewing, and 54 after RoleBasedAccessing. Each suite
used an injected, isolated MongoDB database rather than application data.

### October 11 — Reactions and concurrency

Composition reactions connected meaningful Context changes to Reviews while
leaving the concepts independent. Tests established four essential policies:

- corrections create no Reviews;
- a note attached more than once within one Procedure creates one unfinished
  Review for that Procedure;
- a note shared by two active Procedures creates two Reviews;
- later changes add distinct Causes to the existing unfinished Review.

Retired Procedures are skipped when a new Context change is processed. Existing
pending and completed Reviews for a Procedure remain available after retirement.

The first concurrent version lost one of four Causes. The settlement and
recovery refinement described above corrected the observed failure and added a
deterministic regression test for the refusal path.

### October 11 — Host and HTTP integration

The local host added strict configuration validation, repeatable private Officer
provisioning, protected endpoints, and read formers. An HTTP integration test
created two Procedures, attached one shared note, corrected it without Reviews,
changed it to produce two Reviews, and confirmed only one.

The generated sync-engine read-back and wire contracts are pinned under
`generated/`. The browser derives response types from that contract. Its small
handwritten request projection deliberately omits host-controlled User and
workspace inputs; exposing the raw assembly inputs would weaken the boundary.

### October 11 — Vue MVP and browser walkthrough

The Vue client added the dashboard, ordered Playbooks and Steps, Shared Context,
attachments, correction and meaningful-change forms, pending Reviews, completed
history, and Playbook archiving. Feature presentation was later split into
typed Overview, Playbooks, Context, and Reviews components, leaving `App.vue` as
the coordinator.

A full walkthrough used the isolated database
`relay_browser_demo_verified_c4197e`. It completed the two-Playbook journey,
confirmed one Review, refreshed the page, and still showed one pending Review
and one completed Review. No fixtures were written to the configured
application database.

### October 12 — Hardening and independent review

The final pass aligned the composition specification, route documentation,
session flow, archive semantics, Review reads, frontend types, and the narrower
P2 journey. Server validation now matches the UI limits: 160 characters for a
Playbook title, 500 for Step text, and 4,000 for Context text.

An independent Bugbot review found four issues, all corrected:

- concurrent refreshes could replace newer Vue state;
- server endpoints did not enforce the UI's maximum lengths;
- the Overview called an identity-ordered preview “recent” and counted
  attachments rather than distinct Playbooks;
- the notebook did not contain a durable final validation record.

A separate security review found no actionable issue after checking loopback
binding, Origin and CSRF enforcement, session cookies, request-size limits,
identity injection, workspace authorization, private provisioning, Vite
environment filtering, Vue escaping, and generated-contract usage.

## Final validation record

The final reviewed revision produced these results:

- `bun run test`: **108 passed, 0 failed**, 549 assertions across 9 files.
- `bun run typecheck`: passed.
- `bun run build`: passed; 21 modules transformed.
- `bunx sync-engine check-design design/concepts/*.md design/types.md design/compositions/*.md`:
  passed for 6 files.
- `bunx sync-engine artifacts check`: passed.
- `git diff --check`: passed.

`bunx sync-engine check --show-advisories` passed with 13 nonfatal advisories:
nine `MISSING_ENDPOINT_FALLBACK` warnings on guarded mutation endpoints and four
`ORDER_SENSITIVE_FORMER` information notices on explicitly arranged reads. The
analyzer cannot prove the complementary guards or the uniqueness of the stable
arrangement keys. No overlapping catch-all response was added merely to silence
the diagnostic.

### October 13 — Submission alignment

The formal concept and composition specifications were restored to `design/`,
the location required by the assignment and referenced by
`generated.config.ts`. Submission links now point from `design/` and the root
README to the journey under `mvp/`.

A live sign-in failure revealed that the host returned the same public error
for an invalid browser Origin and an Officer permission denial. The behavior
was secure but the explanation was wrong: opening `localhost:5173` produced
“not authorized for the configured officer,” even though authorization had not
run. The host now returns `ORIGIN_REJECTED`, and the browser tells the operator
to use `http://127.0.0.1:5173`. Backend and frontend regression tests preserve
that distinction.

The assignment source was also checked against the saved recording. The file
is a valid 4-minute, 38-second MP4, but P2 permits at most two minutes. It starts
with populated Playbooks and ends after both Reviews are confirmed, while the
submitted clean-workspace journey leaves one Review pending. This limitation is
recorded rather than hidden; a new narrated recording is required before
submission.

## P3 Questioning increment — October 17

The first feedback-driven P3 addition implements the P1 `Questioning` concept
once and instantiates it for both Steps and Context Notes. Questions store only
a stable Subject identity, their original text, lifecycle status, and optional
answer. Relay's composition—not the generic concept—checks workspace ownership
and grants Members `ASK_QUESTION` while reserving `ANSWER_QUESTION` for
Officers. At that increment, tests used separate trusted host sessions and role
assignments to prove the Member policy without treating request-body identities
as authentication; the later identity increment exposed that behavior through
real accounts and invitations.

The professor's concern that questions could disappear into the interface led
to one clear officer Questions inbox rather than a notification subsystem.
Every open Step and Context Question appears there with an actionable answer
form, and navigation shows a live unanswered count. Questions and answers also
appear beside active source content. The inbox retains answered history and
can still resolve a removed Step's original text and `REMOVED` status, proving
that reordering or removal does not break the Question's stable association.

## Remaining risks and P3 work

- Bun is outside the HTTP package's documented Node.js runtime contract.
- Reaction tests do not establish exactly-once behavior across arbitrary
  process crashes.
- Two existing published commits are both named `delete`. Rewriting published
  history was intentionally avoided; a descriptive final commit and this
  notebook should carry the final hardening evidence.
- The current recording exceeds the two-minute limit and does not match the
  clean-workspace journey's final state; it must be replaced before submission.

## P3 Beta identity and workspace increment — October 17

Relay now uses ordinary email/password accounts because this is the smallest
secure mechanism that works with the class's public deployment expectations
without adding an external identity-provider dependency. Passwords use salted
scrypt hashes. Opaque session tokens are stored only as SHA-256 digests in
MongoDB, expire after eight hours, and remain protected by HttpOnly,
SameSite=Strict cookies, an exact-origin check, and a per-session CSRF token.
This also means a fresh server process can validate an existing browser session.

Account registration deliberately grants nothing. Creating a club makes that
verified account its Officer; accepting a one-time, email-bound invitation adds
the verified account as a Member. Officers can invite Members, but neither the
invitation request nor its acceptance accepts a role choice. This directly
prevents the tempting body-field attack where a member asks to become an
Officer. RoleBasedAccessing remains the permission authority, while the host
owns only authentication, workspace selection, and onboarding state.

Members use `ASK_QUESTION` as the shared knowledge-access permission: it allows
workspace-scoped Playbook, Context, and Question reads as well as asking.
Officer-only Review reads are omitted from Member refreshes, and mutation
controls are hidden according to the permissions returned for the selected
workspace. These interface checks improve clarity; the backend authorization
checks remain decisive. The workspace name, role, and selector are always
visible, so switching clubs cannot be mistaken for changing filters within one
club.

## P3 Beta deployment hardening — October 17

The Fall 2026 deployment guide changed a few host-level choices without
changing Relay's concepts. Production now reads the platform's
`PUBLIC_ORIGIN`, honors its `HOST` and `PORT`, serves the Vite build from a
path independent of the process working directory, and exposes a small
`/health` route that checks the already-shared MongoDB client. The health route
does not disclose the database name or connection details. Relay keeps one
MongoClient for the process and calls `db()` without overriding the database
encoded by the platform URI.

Deployment hardening keeps the existing password and session boundary rather
than adding another identity system. Passwords remain salted scrypt
hashes; only digests of opaque, expiring session tokens are stored. Production
cookies become Secure because the exact public origin is HTTPS, and mutations
still require both the server-derived identity and per-session CSRF token.
Platform settings and secrets belong in 6.1040 Apps, never in Vite variables or
the repository.

The sync-engine checker reports 26 non-fatal advisories. The 20 endpoint
advisories are conservative: each operation starts with an authorization
action whose refusal is converted by the HTTP policy, and every resource guard
has tested unavailable branches; action-level domain refusals are likewise
mapped to bounded public errors. The six former advisories are also reviewed:
each repeated collection has an explicit `.arranged(...)` key, while the two
optional `whether` selections can match at most one identity record. The
invalid-action and concurrency tests exercise the risky paths, so no
composition change was justified solely to silence the checker.

## Final Reflection

**1. Why is a meaningful change modeled separately from a wording correction?**

I wanted Relay to distinguish between changing how information is written and changing what the information actually means. Fixing a typo shouldn't force officers to review every Playbook that references the note. However, changing a policy from annual to semester renewals could affect multiple procedures. By separating `correct` from `change` in ContextTracking, I can preserve this distinction without asking Relay to guess whether two versions of a note mean the same thing.

**2. Why does Reviewing, rather than a reaction guard, enforce unfinished-Review uniqueness?**

Initially, I thought checking whether a Review already existed before creating one would be enough. But that check isn't reliable when multiple changes happen concurrently. Two reactions can both see that no Review exists and attempt to create one. I realized the rule that only one unfinished Review can exist for an item belongs inside Reviewing itself, where it can be enforced atomically through MongoDB. The reactions decide when to request a Review, while Reviewing guarantees that its own state remains valid.

**3. What did the missing concurrent Cause reveal that isolated concept tests could not reveal?**

The most interesting bug I encountered was that four concurrent Context Changes sometimes resulted in a Review containing only three Causes. The individual concepts passed their tests, but the problem appeared when multiple reactions interacted and completed in different orders. This taught me that testing concepts independently isn't enough to establish that their composition behaves correctly. I added a regression test for concurrent changes and a separate test for the refusal-recovery path so that losing a Cause would be detected again.

**4. Why must the host replace browser-supplied User and workspace identities?**

I realized that frontend checks alone don't provide real authorization because a client can construct requests independently of the interface. If Relay trusted a User or workspace ID supplied in a request, someone could potentially claim another identity or access another club's data. Instead, the host establishes the configured Officer and workspace and supplies those trusted identities to the composition. RoleBasedAccessing then authorizes operations against them. This keeps authentication separate from the concepts while ensuring authorization is enforced in the backend.

**5. Which current limitation should become the first P3 increment, and which concept or reaction would own it?**

I would prioritize allowing officers to update Playbook Steps after reviewing a meaningful Context Change. Currently, Relay can identify an outdated assumption and request a Review, but it doesn't yet support the complete workflow for revising the affected procedure. I would extend ProcedureMaintaining with authorized Step-editing operations and use the existing reviewing workflow to let an officer confirm the Review after making any necessary updates. The composition would coordinate these actions while keeping ProcedureMaintaining responsible for Steps and Reviewing responsible for Review state.

I think this is the most important next increment because it completes the loop from identifying a potentially outdated procedure to actually updating it. It also builds directly on Relay's existing concepts rather than requiring an entirely new system.
