# Relay — P2 Design Notebook

## What this document is for

This notebook is an engineering record for the 6.1040 P2 evaluation. It is
written for a reader who knows concept design and sync-engine but has not seen
Relay before. It explains the implemented MVP, the decisions that shaped it,
the failures that changed the design, and the evidence behind its claims.

Relay addresses a specific handoff problem: a procedure can remain polished
and plausible after the information behind it has changed. The MVP connects
repeatable **Playbooks** to shared **Context Notes**. A wording correction stays
quiet. A meaningful change preserves its before/after text and asks an officer
to review every affected active Playbook.

The room-renewal policy used in the demo is fictional. It illustrates the
workflow; it is not a statement about current MIT policy.

## The implemented journey

A newly elected student-club officer inherits two Playbooks:

- **Plan the Annual Club Showcase**
- **Renew Club Room Access**

Both depend on one Context Note saying that room access is renewed annually.
The officer attaches that note to the relevant Step in each Playbook. Fixing a
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

- `bun run test`: **107 passed, 0 failed**, 547 assertions across 9 files.
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

## Remaining risks and P3 work

- Browser sessions are in memory and expire on restart.
- The shared local credential is not multi-user or production authentication.
- Bun is outside the HTTP package's documented Node.js runtime contract.
- Reaction tests do not establish exactly-once behavior across arbitrary
  process crashes.
- Member questions, multiple clubs, general registration, invitations, and full
  Review resolution remain outside P2.
- Two existing published commits are both named `delete`. Rewriting published
  history was intentionally avoided; a descriptive final commit and this
  notebook should carry the final hardening evidence.
- The latest recording should be inspected manually to confirm that its visible
  actions, narration, and Git revision match this validation record.

## Reflection prompts for the author

These questions identify the judgments worth discussing without inventing a
personal reflection:

- Why is a meaningful change modeled separately from a wording correction?
- Why does Reviewing, rather than a reaction guard, enforce unfinished-Review
  uniqueness?
- What did the missing concurrent Cause reveal that isolated concept tests could
  not reveal?
- Why must the host replace browser-supplied User and workspace identities?
- Which current limitation should become the first P3 increment, and which
  concept or reaction would own it?
