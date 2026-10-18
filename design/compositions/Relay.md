# Relay

Relay lets club officers maintain reusable Procedures and shared ContextNotes,
then reconsider each active Procedure affected by a meaningful context change.
All public operations are scoped to a `ClubWorkspace` selected from the
authenticated User's current memberships. The API does not accept a User
identity as an ordinary caller-controlled field: the host must establish the
caller's identity at a trustworthy authentication boundary and supply that
verified `User` to the composition before authorization.

## Provisioning before public use

An empty concept store has no Roles, Permissions, or Assignments. Before the
listener opens, the host creates or verifies the shared `Officer` and `Member`
Roles and their exact permission sets. Creating a club then creates a
`ClubWorkspace` identity and assigns the `Officer` Role to that verified User
using `RoleBasedAccessing.createRole`, `RoleBasedAccessing.permit`, and
`RoleBasedAccessing.assign`. These setup operations are not public endpoints
and must not be callable by ordinary users. Role creation and assignment stay
within this controlled setup path; the public composition has no general role
administration operation.

The sync-engine composition document format declares reaction links and
endpoint paths, but does not express a private startup hook, account store,
workspace-membership source, or authentication provider. Role provisioning,
workspace creation, and the authentication boundary are therefore supplied by
the host. The host must fail closed when it
cannot establish a trustworthy User identity. The User value supplied to
`RoleBasedAccessing.authorize` must come from that trusted boundary, never
from an unverified request body.

The P3 host stores accounts, club names, invitations, and sessions in MongoDB.
Passwords are salted and hashed with scrypt; the browser receives only a
random opaque session token in an HttpOnly, SameSite=Strict cookie. Only a
SHA-256 digest of that token is stored. Sessions expire after eight hours and
protected requests require both the configured exact Origin and the session's
CSRF token. HTTPS deployments add the cookie's Secure attribute.

Registration creates an account but grants no workspace access. An
authenticated user may create a ClubWorkspace, which assigns the existing
Officer Role through a private host operation, or accept an unexpired,
single-use invitation addressed to the account's normalized email, which
assigns Member. Invitation requests require the inviter to hold the
Officer-only `EDIT_PROCEDURE` permission. No public operation accepts a Role,
Permission, Assignment, User, or selected workspace as authority: the host
loads both User and selected workspace from the server-side session and
replaces any forged body fields before invoking the composition.

## Procedures

An officer creates Procedures and adds their ordered Steps through authorized
operations. `CreateProcedure` authorizes the request for `EDIT_PROCEDURE`
before calling `ProcedureMaintaining.create` for the selected workspace.
`AddStep` authorizes the verified officer for `EDIT_PROCEDURE`, verifies that
the requested Procedure is active and belongs to the selected workspace,
and then calls `ProcedureMaintaining.addStep`. The concept action guards remain
authoritative for active Procedure state and refusals.

[Creating a Procedure](reaction:Relay.ProcedureOperations.CreateProcedure)
and [adding a Step](reaction:Relay.ProcedureOperations.AddStep) return their
created identities. The procedure read endpoint uses
[ListProcedures](reaction:Relay.ReadOperations.ListProcedures) and
[WorkspaceProcedures](former:Relay.Reads.WorkspaceProcedures), which lists
Procedures for the workspace with their identities, titles, statuses, and
active Steps ordered by position.

[Renaming a Playbook](reaction:Relay.ProcedureOperations.RenameProcedure),
[editing a Step](reaction:Relay.ProcedureOperations.EditStep),
[moving a Step](reaction:Relay.ProcedureOperations.MoveStep), and
[removing a Step](reaction:Relay.ProcedureOperations.RemoveStep) each
authorize with `EDIT_PROCEDURE` and require the active Procedure to belong to
the selected workspace. Step operations additionally require the active
Step to belong to that Procedure. User-authored titles and Step text use the
same nonblank limits as creation. Moving keeps stable Step identities while
the concept restores contiguous positions; removing keeps the removed Step's
identity and text outside the active order. After a removal,
[DetachRemovedStepContext](reaction:Relay.StepRemoval.DetachRemovedStepContext)
detaches every Context attachment anchored at that Step. Procedure-level and
other Step attachments are unchanged.

[Archiving a Playbook](reaction:Relay.ProcedureOperations.ArchiveProcedure)
authorizes with `EDIT_PROCEDURE` and calls `ProcedureMaintaining.retire` only
for an active Procedure owned by the selected workspace. It preserves the
Procedure, Steps, Context attachments, and Review history. The procedure read
still returns retired Procedures so the frontend can separate them into its
archived section; retired Procedures are excluded from active UI lists and
from reactions that create new Reviews. Unknown,
foreign-workspace, or already archived Procedures are refused as unavailable.

```endpoints
Relay.ProcedureOperations.CreateProcedure at /workspaces/procedures/create
Relay.ProcedureOperations.AddStep at /workspaces/procedures/steps/add
Relay.ProcedureOperations.RenameProcedure at /workspaces/procedures/rename
Relay.ProcedureOperations.EditStep at /workspaces/procedures/steps/edit
Relay.ProcedureOperations.MoveStep at /workspaces/procedures/steps/move
Relay.ProcedureOperations.RemoveStep at /workspaces/procedures/steps/remove
Relay.ProcedureOperations.ArchiveProcedure at /workspaces/procedures/archive
Relay.ReadOperations.ListProcedures at /workspaces/procedures
```

## Shared context and review

[RecordContextNote](reaction:Relay.ContextOperations.RecordContextNote),
[AttachContextNote](reaction:Relay.ContextOperations.AttachContextNote),
and
[AttachContextNoteAtStep](reaction:Relay.ContextOperations.AttachContextNoteAtStep)
authorize with `EDIT_CONTEXT`. The composition requires a note's Scope and
the Procedure's Space to be the selected workspace, requires the target
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

## Requiring changes, resolving, and cancelling Reviews

[RequireReviewChanges](reaction:Relay.ReviewOperations.RequireReviewChanges)
authorizes with `COMPLETE_REVIEW` and changes a `PENDING` Review for an active,
in-workspace Playbook to `CHANGES_REQUIRED`. The officer then uses the ordinary
authorized Procedure operations to edit, reorder, add, remove, or rename the
affected Playbook. Relay deliberately does not couple `Reviewing` to
`ProcedureMaintaining` or infer whether an edit is sufficient.

[ResolveReview](reaction:Relay.ReviewOperations.ResolveReview) explicitly
completes a `CHANGES_REQUIRED` Review after the officer has made and checked
the necessary edits. It requires the affected Playbook to remain active and
in the workspace. [CancelReview](reaction:Relay.ReviewOperations.CancelReview)
can instead cancel either unfinished status when the Review is no longer
appropriate; cancellation is also available for an archived in-workspace
Playbook. Both completion and cancellation preserve the Review and all Cause
identities in the all-status history former. Unknown, mismatched,
foreign-workspace, and lifecycle-incompatible requests use the same
non-disclosing unavailable response at the application boundary.

```endpoints
Relay.ReviewOperations.RequireReviewChanges at /workspaces/reviews/require-changes
Relay.ReviewOperations.ResolveReview at /workspaces/reviews/resolve
Relay.ReviewOperations.CancelReview at /workspaces/reviews/cancel
```

## Asking and answering Questions

Relay instantiates the generic `Questioning` concept twice. Step Questions use
stable `ProcedureMaintaining.Step` identities; Context Questions use
`ContextTracking.ContextNote` identities. Reordering a Step therefore does not
move its Questions to a different instruction, and removing a Step does not
delete its Questions or answers.

[AskStepQuestion](reaction:Relay.QuestionOperations.AskStepQuestion) authorizes
with `ASK_QUESTION`, then requires an active Step belonging to an active
in-workspace Playbook. [AskContextQuestion](reaction:Relay.QuestionOperations.AskContextQuestion)
uses the same permission and requires an in-workspace Context Note attached to
the selected active in-workspace Playbook. Both provisioned Roles have this
permission; Member receives no editing or answering permission.

[AnswerStepQuestion](reaction:Relay.QuestionOperations.AnswerStepQuestion) and
[AnswerContextQuestion](reaction:Relay.QuestionOperations.AnswerContextQuestion)
authorize with `ANSWER_QUESTION`. Only the Officer role is provisioned with
that permission. Answering preserves the original Question text and subject,
stores the answer, and changes the state from `OPEN` to `ANSWERED`. Repeated
answers, unknown Questions, and foreign-workspace Questions are unavailable at
the application boundary.

[GetQuestions](reaction:Relay.ReadOperations.GetQuestions) returns both
[WorkspaceStepQuestions](former:Relay.Reads.WorkspaceStepQuestions) and
[WorkspaceContextQuestions](former:Relay.Reads.WorkspaceContextQuestions).
The Step former resolves both active and removed Step identities, including
their preserved text and status. The Context former resolves the current note
text. Both return open and answered history; the frontend derives its
actionable inbox and unanswered count from the `OPEN` rows instead of creating
a separate notification concept.

```endpoints
Relay.QuestionOperations.AskStepQuestion at /workspaces/questions/steps/ask
Relay.QuestionOperations.AskContextQuestion at /workspaces/questions/context/ask
Relay.QuestionOperations.AnswerStepQuestion at /workspaces/questions/steps/answer
Relay.QuestionOperations.AnswerContextQuestion at /workspaces/questions/context/answer
Relay.ReadOperations.GetQuestions at /workspaces/questions
```

## Authorization and response policy

Every public mutation endpoint first invokes
`RoleBasedAccessing.authorize` with the trusted User, selected workspace,
operation-specific Permission, and an opaque Command representing the
requested operation. Only a successful authorization outcome may proceed to
the corresponding mutation. The composition retains the route's operation
payload while passing the opaque Command through authorization; it does not
interpret or trust a caller-supplied User embedded in that payload.

Procedure and ContextNote reads use `ASK_QUESTION`, which both Member and
Officer Roles hold. Question reads use the same permission. Pending and
historical Review reads continue to use `COMPLETE_REVIEW`, so the frontend does
not request them for Members. Every read remains scoped to the workspace loaded
from the session; selecting a workspace first verifies a current Role
assignment for that User and resource.

The authenticated caller identity is not established by any of these
composition reactions. Sync-engine's documented composition syntax has no
declaration for trusting an identity provider, associating a request with a
verified User, or controlling which network callers may invoke a route. Those
are host and deployment responsibilities and must be implemented before the
public endpoints are enabled. Similarly, the documented syntax does not
express trusted Role provisioning or club creation as a host-only policy, so
neither is declared as a public composition endpoint here.

## HTTP request and response contract

The host owns these non-concept onboarding routes: `POST /auth/register`,
`POST /auth/login`, `GET /session`, `POST /session/logout`, `POST /workspaces`,
`POST /workspaces/create`, `POST /workspaces/select`,
`POST /invitations/create`, and `POST /invitations/accept`. Authenticated host
mutations require the same session, Origin, and CSRF checks as composition
mutations. Session responses include the verified account, selected workspace,
Role, effective Permissions, and all current workspace memberships. Invitation
acceptance always assigns Member, regardless of extra fields in the request.

All composition routes are `POST /api<endpoint-path>` with a JSON object,
same-origin session cookie, and `X-Relay-CSRF` header. The host supplies
`user` and `workspace`; callers do not need and cannot override them.
User-authored text is nonblank and bounded at the same limits as the UI:
Procedure titles are at most 160 characters, Step text at most 500, and
Context Note text for record, correction, or meaningful change at most 4,000.

- `/workspaces/procedures/create` accepts `{ title }` and returns
  `{ procedure }`; `/workspaces/procedures/steps/add` accepts
  `{ procedure, text }` and returns `{ procedure, step }`;
  rename accepts `{ procedure, title }`; Step edit accepts
  `{ procedure, step, text }`; Step move accepts
  `{ procedure, step, position }`; and Step removal accepts
  `{ procedure, step }`. Step mutations return the affected Step identity;
  moving also returns its requested position.
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
  The require-changes, resolve, and cancel routes accept the same identities
  and return the resulting `CHANGES_REQUIRED`, `COMPLETE`, or `CANCELLED`
  status respectively.

The browser transport in `web/api.ts` intentionally omits the generated
contract's trusted `user` and `workspace` inputs. Its response types are
derived from the pinned `generated/wire.ts` contract, while its request methods
remain a small host-aware projection that cannot expose caller-controlled
identity fields. Backend integration tests exercise the actual routes.
