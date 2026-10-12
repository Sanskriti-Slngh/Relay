# Relay

Relay's P2 MVP lets a trusted officer maintain reusable Procedures and shared
ContextNotes, then reconsider each active Procedure affected by a meaningful
context change. All public operations are scoped to the provisioned
`ClubWorkspace`. The API does not accept a User identity as an ordinary
caller-controlled field: the host must establish the caller's identity at a
trustworthy authentication boundary and supply that verified `User` to the
composition before authorization.

## Provisioning before public use

An empty concept store has no workspace identity, Roles, Permissions, or
Assignments. A `ClubWorkspace` identity must therefore be provisioned by the
host, and a trusted one-time operator setup must create the `Officer` Role,
grant it `EDIT_PROCEDURE`, `EDIT_CONTEXT`, and `COMPLETE_REVIEW`, and assign it
to the first verified officer for that workspace using
`RoleBasedAccessing.createRole`, `RoleBasedAccessing.permit`, and
`RoleBasedAccessing.assign`. These setup operations are not public endpoints
and must not be callable by ordinary users. Role creation and assignment stay
within this controlled setup path; the public composition has no general role
administration operation.

The sync-engine composition document format declares reaction links and
endpoint paths, but does not express a private startup hook, an operator-only
access policy, or an authentication provider. The one-time setup mechanism,
workspace identity source, and authentication boundary must be supplied by the
host before the public routes are enabled. The host must fail closed when it
cannot establish a trustworthy User identity. The User value supplied to
`RoleBasedAccessing.authorize` must come from that trusted boundary, never
from an unverified request body.

The local P2 host validates stable workspace and officer identities, the
MongoDB URI, and a high-entropy local access credential before connecting or
listening. It completes the private Officer provisioning path before binding
the HTTP listener to `127.0.0.1`. The browser submits the configured credential
only to the same-origin `/session` login route. The host exchanges it for an
in-memory session identified by an HttpOnly, SameSite=Strict cookie and returns
a CSRF token. The frontend sends that cookie and token—not a Bearer
credential—to protected composition routes. Before those routes reach the
sync-engine handler, the host replaces any request-body User and workspace
values with the validated server configuration and enforces a bounded JSON
body size.
This is a single-user local-demo boundary, not general-purpose authentication;
network deployment requires a real verified identity mechanism.
Protected requests require the unexpired session, matching CSRF token, and
exact local Origin. `GET /session` reports session state, `POST /session`
signs in, and `POST /session/logout` revokes the current session. The
credential is neither returned by a configuration endpoint nor included in
the frontend bundle.

## Procedures

An officer creates Procedures and adds their ordered Steps through authorized
operations. `CreateProcedure` authorizes the request for `EDIT_PROCEDURE`
before calling `ProcedureMaintaining.create` for the provisioned workspace.
`AddStep` authorizes the verified officer for `EDIT_PROCEDURE`, verifies that
the requested Procedure is active and belongs to the configured workspace,
and then calls `ProcedureMaintaining.addStep`. The concept action guards remain
authoritative for active Procedure state and refusals.

[Creating a Procedure](reaction:Relay.ProcedureOperations.CreateProcedure)
and [adding a Step](reaction:Relay.ProcedureOperations.AddStep) return their
created identities. The procedure read endpoint uses
[ListProcedures](reaction:Relay.ReadOperations.ListProcedures) and
[WorkspaceProcedures](former:Relay.Reads.WorkspaceProcedures), which lists
Procedures for the workspace with their identities, titles, statuses, and
active Steps ordered by position.

[Archiving a Playbook](reaction:Relay.ProcedureOperations.ArchiveProcedure)
authorizes with `EDIT_PROCEDURE` and calls `ProcedureMaintaining.retire` only
for an active Procedure owned by the configured workspace. It preserves the
Procedure, Steps, Context attachments, and Review history. The procedure read
still returns retired Procedures so the frontend can separate them into its
archived section; retired Procedures are excluded from active UI lists and
from reactions that create new Reviews. Unknown,
foreign-workspace, or already archived Procedures are refused as unavailable.

```endpoints
Relay.ProcedureOperations.CreateProcedure at /workspaces/procedures/create
Relay.ProcedureOperations.AddStep at /workspaces/procedures/steps/add
Relay.ProcedureOperations.ArchiveProcedure at /workspaces/procedures/archive
Relay.ReadOperations.ListProcedures at /workspaces/procedures
```

## Shared context and review

[RecordContextNote](reaction:Relay.ContextOperations.RecordContextNote),
[AttachContextNote](reaction:Relay.ContextOperations.AttachContextNote),
and
[AttachContextNoteAtStep](reaction:Relay.ContextOperations.AttachContextNoteAtStep)
authorize with `EDIT_CONTEXT`. The composition requires a note's Scope and
the Procedure's Space to be the provisioned workspace, requires the target
Procedure to be active, and, for an anchored attachment, requires the Step to
be active and to belong to that Procedure. Only after those checks does the
composition call the corresponding `ContextTracking` action. These
application-level relationships do not make either concept depend on the
other.

[CorrectContextNote](reaction:Relay.ContextOperations.CorrectContextNote)
authorizes and calls `ContextTracking.correct`. It does not trigger a Review.
[ChangeContextNote](reaction:Relay.ContextOperations.ChangeContextNote)
authorizes and calls
`ContextTracking.change`; a meaningful change preserves its exact before and
after text and is handled by two mutually exclusive composition reactions.
[RequestReviewForChangedContext](reaction:Relay.ContextChanges.RequestReview)
requests one Review for each attached, active Procedure that has no unfinished
Review. [AddCauseToUnfinishedReview](reaction:Relay.ContextChanges.AddChangeCause)
adds the new Change as a Cause to that Procedure's existing unfinished Review.
The second reaction uses `Reviewing.addCause`, not another `Reviewing.request`.
If a concurrent request wins after the no-unfinished-Review check, its
`REQUEST_ALREADY_UNFINISHED` refusal is handled by
[AddCauseAfterConcurrentRequestRefusal](reaction:Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal),
which looks up the existing unfinished Review and attempts to add the Change as
a Cause.
Both reactions ignore attachments whose Procedure is not active and bind only
the affected Procedure identity from `ContextTracking._attachments`. They must
not bind the distinct Step anchors or Attachment identities, so multiple
attachments of one ContextNote to different Steps of the same Procedure do not
create unnecessary distinct reaction bindings. Sync-engine retains the first
structurally distinct fill for a many-row read; this matching behavior is not a
substitute for state-level uniqueness. The `Reviewing` concept remains unaware
of ContextNotes and Procedures.

`Reviewing.request` must enforce the at-most-one-unfinished-Review-per-Item
invariant atomically in MongoDB, using an appropriate transaction or database
constraint for the Review status transition. This is required even though the
reaction binds one Procedure identity: reaction-level deduplication does not
protect against overlapping flows, retries, or multiple processes.

`ChangeContextNote` returns only `{ context, change }`; it does not include or
promise a pending-Review snapshot. The local HTTP host waits for the assembled
application to become idle after a successful change response, and the
frontend then retrieves pending Reviews separately. The `AddChangeCause`
reaction uses `.afterFlowSettles()` plus a duplicate-Cause guard to cover the
tested overlapping-change schedule. This is not an exactly-once guarantee
under arbitrary process crashes or every possible lifecycle race.

The context read endpoint
[GetContextHistory](reaction:Relay.ReadOperations.GetContextHistory) uses
[WorkspaceContextHistory](former:Relay.Reads.WorkspaceContextHistory) to
return the workspace's ContextNotes, their Attachments (including optional
Step anchors), and their Change records with the exact before and after text.
The pending-review endpoint
[GetPendingReviews](reaction:Relay.ReadOperations.GetPendingReviews) uses
[PendingReviews](former:Relay.Reads.PendingReviews) to return unfinished
Reviews and their Causes, resolving each Cause through
`ContextTracking._getChange` so the preserved text is available to the
officer.
The all-status review-history endpoint
[GetReviewHistory](reaction:Relay.ReadOperations.GetReviewHistory) uses
[WorkspaceReviewHistory](former:Relay.Reads.WorkspaceReviewHistory) to return
each in-workspace Procedure's Reviews, including completed Reviews, with their
Cause text. The frontend uses the pending endpoint for its actionable inbox
and the history endpoint to show confirmed state after refresh.

```endpoints
Relay.ContextOperations.RecordContextNote at /workspaces/context/notes
Relay.ContextOperations.AttachContextNote at /workspaces/context/attachments
Relay.ContextOperations.AttachContextNoteAtStep at /workspaces/context/step-attachments
Relay.ContextOperations.CorrectContextNote at /workspaces/context/correct
Relay.ContextOperations.ChangeContextNote at /workspaces/context/change
Relay.ReadOperations.GetContextHistory at /workspaces/context
Relay.ReadOperations.GetPendingReviews at /workspaces/reviews/pending
Relay.ReadOperations.GetReviewHistory at /workspaces/reviews
```

## Confirming a Review

[ConfirmReview](reaction:Relay.ReviewOperations.ConfirmReview) authorizes with
`COMPLETE_REVIEW` for the Review's Procedure and workspace, then calls
`Reviewing.confirm`. The concept enforces that the
Review is `PENDING`; an authorization result does not bypass its lifecycle
guard. The operation returns `{ review, status: "COMPLETE" }`. A completed
Review no longer matches the pending confirmation route, so repeating the
request is refused as unavailable. Unknown, mismatched, and foreign-workspace
identities use the same non-disclosing response.

```endpoints
Relay.ReviewOperations.ConfirmReview at /workspaces/reviews/confirm
```

## Authorization and response policy

Every public mutation endpoint first invokes
`RoleBasedAccessing.authorize` with the trusted User, provisioned workspace,
operation-specific Permission, and an opaque Command representing the
requested operation. Only a successful authorization outcome may proceed to
the corresponding mutation. The composition retains the route's operation
payload while passing the opaque Command through authorization; it does not
interpret or trust a caller-supplied User embedded in that payload.

Read endpoints are also authorized for the officer-only MVP: procedure reads
use `EDIT_PROCEDURE`, ContextNote and Change reads use `EDIT_CONTEXT`, and
pending and historical Review reads use `COMPLETE_REVIEW`. These are existing
application Permission values. This keeps workspace data private while the MVP
has no Member onboarding or read-only Permission policy.

The authenticated caller identity is not established by any of these
composition reactions. Sync-engine's documented composition syntax has no
declaration for trusting an identity provider, associating a request with a
verified User, or controlling which network callers may invoke a route. Those
are host and deployment responsibilities and must be implemented before the
public endpoints are enabled. Similarly, the documented syntax does not
express the trusted one-time bootstrap as an endpoint with a host-only access
policy, so it is deliberately not declared as a public endpoint here.

## HTTP request and response contract

All composition routes are `POST /api<endpoint-path>` with a JSON object,
same-origin session cookie, and `X-Relay-CSRF` header. The host supplies
`user` and `workspace`; callers do not need and cannot override them.

- `/workspaces/procedures/create` accepts `{ title }` and returns
  `{ procedure }`; `/workspaces/procedures/steps/add` accepts
  `{ procedure, text }` and returns `{ procedure, step }`;
  `/workspaces/procedures/archive` accepts `{ procedure }` and returns
  `{ procedure, status: "RETIRED" }`.
- `/workspaces/procedures` accepts `{}` and returns `{ procedures }`, where
  each Procedure has `procedure`, `title`, `status`, and ordered `steps`.
- `/workspaces/context/notes` accepts `{ text }` and returns `{ context }`.
  Attachment routes accept `{ context, procedure }` or
  `{ context, procedure, step }` and return `{ attachment }`.
  Correction accepts `{ context, text }` and returns `{ context }`; meaningful
  change accepts the same fields and returns `{ context, change }`.
- `/workspaces/context` accepts `{}` and returns `{ contexts }`, including each
  note's current text, attachment identities/subjects/optional anchors, and
  preserved Change identities with before/after text.
- `/workspaces/reviews/pending` accepts `{}` and returns `{ reviews }` for
  unfinished Reviews with Procedure titles and resolved Causes.
  `/workspaces/reviews` accepts `{}` and returns `{ procedures }` with all
  Review statuses and Causes. `/workspaces/reviews/confirm` accepts
  `{ review, procedure }` and returns `{ review, status: "COMPLETE" }`.

The browser transport in `web/api.ts` intentionally omits the generated
contract's trusted `user` and `workspace` inputs. Its response types are
derived from the pinned `generated/wire.ts` contract, while its request methods
remain a small host-aware projection that cannot expose caller-controlled
identity fields. Backend integration tests exercise the actual routes.
