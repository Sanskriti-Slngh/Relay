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
the HTTP listener to `127.0.0.1`. The Fetch wrapper requires the configured
Bearer credential, replaces any request-body User and workspace values with
the validated server configuration, and enforces a bounded JSON body size.
This is a single-user local-demo boundary, not general-purpose authentication;
network deployment requires a real verified identity mechanism.
The configured credential is accepted only by the local same-origin login
route. Successful login issues an in-memory browser session with an HttpOnly,
SameSite=Strict cookie and a CSRF token; composition requests require that
session and token and pass an exact local Origin check. The credential is
neither returned by a configuration endpoint nor included in the frontend
bundle.

## Procedures

An officer creates Procedures and adds their ordered Steps through authorized
operations. `CreateProcedure` authorizes the request for `EDIT_PROCEDURE`
before calling `ProcedureMaintaining.create` for the provisioned workspace.
`AddStep` first reads the Step's Procedure when needed to establish its
workspace, authorizes the verified officer for `EDIT_PROCEDURE` in that
workspace, and then calls `ProcedureMaintaining.addStep`. The concept action
guards remain authoritative for active Procedure state and refusals.

[Creating a Procedure](reaction:Relay.ProcedureOperations.CreateProcedure)
and [adding a Step](reaction:Relay.ProcedureOperations.AddStep) return their
created identities. The procedure read endpoint uses
[ListProcedures](reaction:Relay.ReadOperations.ListProcedures) and
[WorkspaceProcedures](former:Relay.Reads.WorkspaceProcedures), which lists
Procedures for the workspace with their identities, titles, statuses, and
active Steps ordered by position.

```endpoints
Relay.ProcedureOperations.CreateProcedure at /workspaces/procedures/create
Relay.ProcedureOperations.AddStep at /workspaces/procedures/steps/add
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

The `ChangeContextNote` endpoint must not promise that pending Reviews are
already available merely because `ContextTracking.change` returned. Its
response should be ordered after the relevant review consequences have settled
if the endpoint promises to include those Reviews. During implementation, use
the documented `.afterFlowSettles()` stage before forming and sending such a
response, and verify that the chosen endpoint flow tracks both review reaction
paths and their `Reviewing.request` or `Reviewing.addCause` actions. If that
causal tracking cannot be established for the chosen endpoint flow, the
response must not claim that Reviews are ready; clients can retrieve pending
Reviews separately after processing completes.

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
guard. The operation returns the confirmed Review identity.

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
