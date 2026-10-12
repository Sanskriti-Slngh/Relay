<!-- Generated from the Relay P2 MVP assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Relay P2 MVP — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### ContextTracking

Defined in [ContextTracking](../design/concepts/ContextTracking.md), line 1.

#### Actions

- `record(scope: Scope, text: String) : returns (context: ContextNote)`
- `attach(context: ContextNote, subject: Subject) : returns (attachment: Attachment)`
  - Refuses `CONTEXT_NOT_FOUND`: There is no such ContextNote.
  - Refuses `ATTACHMENT_ALREADY_EXISTS`: That ContextNote is already attached to the subject without an anchor.
- `attachAt(context: ContextNote, subject: Subject, anchor: Anchor) : returns (attachment: Attachment)`
  - Refuses `CONTEXT_NOT_FOUND`: There is no such ContextNote.
  - Refuses `ATTACHMENT_ALREADY_EXISTS`: That ContextNote is already attached to the subject at that anchor.
- `detach(attachment: Attachment) : returns ()`
  - Refuses `ATTACHMENT_NOT_FOUND`: There is no such Attachment.
- `correct(context: ContextNote, text: String) : returns ()`
  - Refuses `CONTEXT_NOT_FOUND`: There is no such ContextNote.
- `change(context: ContextNote, text: String) : returns (change: Change)`
  - Refuses `CONTEXT_NOT_FOUND`: There is no such ContextNote.
  - Refuses `CHANGE_NOT_DIFFERENT`: The new text must differ from the current text.

#### Queries

- `_notes(scope: Scope) : many (context: ContextNote, text: String)`
- `_get(context: ContextNote) : optional (scope: Scope, text: String)`
- `_attachments(context: ContextNote) : many (attachment: Attachment, subject: Subject, anchor?: Anchor)`
- `_getAttachment(attachment: Attachment) : optional (context: ContextNote, subject: Subject, anchor?: Anchor)`
- `_changes(context: ContextNote) : many (change: Change, before: String, after: String)`
- `_getChange(change: Change) : optional (context: ContextNote, before: String, after: String)`

#### Instances

- `ContextTracking` — instance of `ContextTracking` — [Relay MVP Application Types](../design/types.md), line 32.
  - `Anchor` is `ProcedureMaintaining.Step` — [Relay MVP Application Types](../design/types.md), line 35.
  - `Scope` is `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 33.
  - `Subject` is `ProcedureMaintaining.Procedure` — [Relay MVP Application Types](../design/types.md), line 34.

### ProcedureMaintaining

Defined in [ProcedureMaintaining](../design/concepts/ProcedureMaintaining.md), line 1.

#### Actions

- `create(space: Space, title: String) : returns (procedure: Procedure)`
- `addStep(procedure: Procedure, text: String) : returns (step: Step)`
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Procedure is retired.
- `editStep(step: Step, text: String) : returns ()`
  - Refuses `STEP_NOT_FOUND`: There is no such Step.
  - Refuses `STEP_NOT_ACTIVE`: The Step has been removed.
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Step's Procedure is retired.
- `moveStep(step: Step, position: Number) : returns ()`
  - Refuses `STEP_NOT_FOUND`: There is no such Step.
  - Refuses `STEP_NOT_ACTIVE`: The Step has been removed.
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Step's Procedure is retired.
  - Refuses `INVALID_POSITION`: Position must be an integer within the active Step order.
- `removeStep(step: Step) : returns ()`
  - Refuses `STEP_NOT_FOUND`: There is no such Step.
  - Refuses `STEP_NOT_ACTIVE`: The Step has been removed.
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Step's Procedure is retired.
- `rename(procedure: Procedure, title: String) : returns ()`
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Procedure is retired.
- `retire(procedure: Procedure) : returns ()`
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Procedure is already retired.

#### Queries

- `_procedures(space: Space) : many (procedure: Procedure, title: String, status: ProcedureStatus)`
- `_get(procedure: Procedure) : optional (space: Space, title: String, status: ProcedureStatus)`
- `_steps(procedure: Procedure) : many (step: Step, text: String, position: Number)`
- `_getStep(step: Step) : optional (procedure: Procedure, text: String, status: StepStatus)`

#### Instances

- `ProcedureMaintaining` — instance of `ProcedureMaintaining` — [Relay MVP Application Types](../design/types.md), line 29.
  - `Space` is `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 30.

### Reviewing

Defined in [Reviewing](../design/concepts/Reviewing.md), line 1.

#### Actions

- `request(item: Item, cause: Cause) : returns (review: Review)`
  - Refuses `REQUEST_ALREADY_UNFINISHED`: This Item already has an unfinished Review; add the cause to that Review.
- `addCause(review: Review, cause: Cause) : returns ()`
  - Refuses `ADD_CAUSE_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `ADD_CAUSE_REVIEW_FINISHED`: Causes can only be added to an unfinished Review.
  - Refuses `CAUSE_ALREADY_PRESENT`: That cause is already associated with the Review.
- `confirm(review: Review) : returns ()`
  - Refuses `CONFIRM_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `REVIEW_NOT_PENDING_FOR_CONFIRMATION`: Only a PENDING Review can be confirmed.
- `requireChanges(review: Review) : returns ()`
  - Refuses `REQUIRE_CHANGES_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `REVIEW_NOT_PENDING_FOR_CHANGES`: Only a PENDING Review can be marked as requiring changes.
- `resolve(review: Review) : returns ()`
  - Refuses `RESOLVE_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `REVIEW_NOT_AWAITING_CHANGES`: Only a Review requiring changes can be resolved.
- `cancel(review: Review) : returns ()`
  - Refuses `CANCEL_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `CANCEL_REVIEW_FINISHED`: Only an unfinished Review can be cancelled.

#### Queries

- `_unfinished() : many (review: Review, item: Item, status: ReviewStatus)`
- `_forItem(item: Item) : many (review: Review, status: ReviewStatus)`
- `_get(review: Review) : optional (item: Item, status: ReviewStatus)`
- `_causes(review: Review) : many (cause: Cause)`

#### Instances

- `Reviewing` — instance of `Reviewing` — [Relay MVP Application Types](../design/types.md), line 37.
  - `Cause` is `ContextTracking.Change` — [Relay MVP Application Types](../design/types.md), line 39.
  - `Item` is `ProcedureMaintaining.Procedure` — [Relay MVP Application Types](../design/types.md), line 38.

### RoleBasedAccessing

Defined in [RoleBasedAccessing](../design/concepts/RoleBasedAccessing.md), line 1.

#### Actions

- `createRole(name: String) : returns (role: Role)`
  - Refuses `ROLE_NAME_ALREADY_EXISTS`: A Role already has that name.
- `deleteRole(role: Role) : returns ()`
  - Refuses `ROLE_NOT_FOUND`: There is no such Role.
  - Refuses `ROLE_IN_USE`: The Role is assigned and cannot be deleted.
- `permit(role: Role, permission: Permission) : returns ()`
  - Refuses `ROLE_NOT_FOUND`: There is no such Role.
  - Refuses `PERMISSION_ALREADY_GRANTED`: The Role already has that Permission.
- `revokePermission(role: Role, permission: Permission) : returns ()`
  - Refuses `ROLE_NOT_FOUND`: There is no such Role.
  - Refuses `PERMISSION_NOT_GRANTED`: The Role does not have that Permission.
- `assign(user: User, resource: Resource, role: Role) : returns (assignment: Assignment)`
  - Refuses `ROLE_NOT_FOUND`: There is no such Role.
  - Refuses `ASSIGNMENT_ALREADY_EXISTS`: That Role is already assigned to the User for the Resource.
- `unassign(assignment: Assignment) : returns ()`
  - Refuses `ASSIGNMENT_NOT_FOUND`: There is no such Assignment.
- `authorize(user: User, resource: Resource, permission: Permission, command: Command) : returns (authorized: Command)`
  - Refuses `NOT_AUTHORIZED`: The User does not have the required Permission for the Resource.

#### Queries

- `_roles() : many (role: Role, name: String)`
- `_getRole(role: Role) : optional (name: String)`
- `_permissions(role: Role) : many (permission: Permission)`
- `_assignmentsFor(user: User, resource: Resource) : many (assignment: Assignment, role: Role)`
- `_getAssignment(assignment: Assignment) : optional (user: User, resource: Resource, role: Role)`

#### Instances

- `RoleBasedAccessing` — instance of `RoleBasedAccessing` — [Relay MVP Application Types](../design/types.md), line 41.
  - `Command` is `Command` — [Relay MVP Application Types](../design/types.md), line 45.
  - `Permission` is `Permission` — [Relay MVP Application Types](../design/types.md), line 44.
  - `Resource` is `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 43.
  - `User` is `User` — [Relay MVP Application Types](../design/types.md), line 42.

## Application types

Concrete types:

- `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 10.
- `Command` — [Relay MVP Application Types](../design/types.md), line 19.
- `Permission` — [Relay MVP Application Types](../design/types.md), line 16.
- `User` — [Relay MVP Application Types](../design/types.md), line 13.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### Relay.Reads.PendingReviews

Authored path: `Relay.Reads.PendingReviews`.
- Covered by [Relay](../design/compositions/Relay.md), line 146.

```former
Former "Relay.Reads.PendingReviews" — inputs (workspace); bindings (review, procedure, status, title, cause, before, after); promises exactly one record — forms:
  each Reviewing._unfinished () has (item: procedure, review, status)
    where ProcedureMaintaining._get (procedure) has (space: workspace, title)
    arranged by review
    form a record of
      causes: each Reviewing._causes (review) has (cause)
        where ContextTracking._getChange (change: cause) has (after, before)
        arranged by cause
        form a record of
          after
          before
          cause
      procedure
      review
      status
      title
```

### Relay.Reads.WorkspaceContextHistory

Authored path: `Relay.Reads.WorkspaceContextHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 141.

```former
Former "Relay.Reads.WorkspaceContextHistory" — inputs (workspace); bindings (context, text, attachment, subject, anchor, change, before, after); promises exactly one record — forms:
  each ContextTracking._notes (scope: workspace) has (context, text)
    arranged by context
    form a record of
      attachments: each ContextTracking._attachments (context) has (attachment, subject)
        where whether ContextTracking._getAttachment (attachment) has (anchor)
        arranged by attachment
        form a record of
          anchor
          attachment
          subject
      changes: each ContextTracking._changes (context) has (after, before, change)
        arranged by change
        form a record of
          after
          before
          change
      context
      text
```

### Relay.Reads.WorkspaceProcedures

Authored path: `Relay.Reads.WorkspaceProcedures`.
- Covered by [Relay](../design/compositions/Relay.md), line 66.

```former
Former "Relay.Reads.WorkspaceProcedures" — inputs (workspace); bindings (procedure, title, status, step, text, position); promises exactly one record — forms:
  each ProcedureMaintaining._procedures (space: workspace) has (procedure, status, title)
    arranged by procedure
    form a record of
      procedure
      status
      steps: each ProcedureMaintaining._steps (procedure) has (position, step, text)
        arranged by position
        form a record of
          position
          step
          text
      title
```

### Relay.Reads.WorkspaceReviewHistory

Authored path: `Relay.Reads.WorkspaceReviewHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 152.

```former
Former "Relay.Reads.WorkspaceReviewHistory" — inputs (workspace); bindings (procedure, title, review, status, cause, before, after); promises exactly one record — forms:
  each ProcedureMaintaining._procedures (space: workspace) has (procedure, title)
    arranged by procedure
    form a record of
      procedure
      reviews: each Reviewing._forItem (item: procedure) has (review, status)
        arranged by review
        form a record of
          causes: each Reviewing._causes (review) has (cause)
            where ContextTracking._getChange (change: cause) has (after, before)
            arranged by cause
            form a record of
              after
              before
              cause
          review
          status
      title
```

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal

Authored path: `Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal`.
- Covered by [Relay](../design/compositions/Relay.md), line 113.

```reaction
when refused Reviewing.request (cause, item, error: "REQUEST_ALREADY_UNFINISHED")
where
  Reviewing._unfinished () has (item, review)
then
  Reviewing.addCause (cause, review)
```

### Relay.ContextChanges.AddChangeCause

Authored path: `Relay.ContextChanges.AddChangeCause`.
- Covered by [Relay](../design/compositions/Relay.md), line 108.

```reaction
when ContextTracking.change (change)
at the flow's settlement frontier
where
  ContextTracking._getChange (change) has (context)
  ContextTracking._attachments (context) has (subject: procedure)
  ProcedureMaintaining._get (procedure) has (status: "ACTIVE")
  Reviewing._unfinished () has (item: procedure, review)
  no Reviewing._causes (review) has (cause: change)
then
  Reviewing.addCause (cause: change, review)
```

### Relay.ContextChanges.RequestReview

Authored path: `Relay.ContextChanges.RequestReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 106.

```reaction
when ContextTracking.change (change)
where
  ContextTracking._getChange (change) has (context)
  ContextTracking._attachments (context) has (subject: procedure)
  ProcedureMaintaining._get (procedure) has (status: "ACTIVE")
  no Reviewing._unfinished () has (item: procedure)
then
  Reviewing.request (cause: change, item: procedure)
```

### Relay.ContextOperations.AttachContextNote

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 89.
- Covered by [Relay](../design/compositions/Relay.md), line 159.

```reaction
when RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.AttachContextNote:context-and-procedure-available#2

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 89.
- Covered by [Relay](../design/compositions/Relay.md), line 159.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ContextTracking.attach (context, subject: procedure)
```

### Relay.ContextOperations.AttachContextNote:context-and-procedure-available#3

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 89.
- Covered by [Relay](../design/compositions/Relay.md), line 159.

```reaction
when ContextTracking.attach (context, subject: procedure, attachment), asked by Relay.ContextOperations.AttachContextNote:context-and-procedure-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
then
  RequestBoundary.respond (attachment, requestId)
```

### Relay.ContextOperations.AttachContextNote:context-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 89.
- Covered by [Relay](../design/compositions/Relay.md), line 159.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "CONTEXT_OR_PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.AttachContextNote:procedure-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 89.
- Covered by [Relay](../design/compositions/Relay.md), line 159.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "CONTEXT_OR_PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.AttachContextNoteAtStep

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 91.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```reaction
when RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE_AT_STEP", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.AttachContextNoteAtStep:context-procedure-and-step-available#2

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 91.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE_AT_STEP", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNoteAtStep
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  ContextTracking.attachAt (anchor: step, context, subject: procedure)
```

### Relay.ContextOperations.AttachContextNoteAtStep:context-procedure-and-step-available#3

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 91.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```reaction
when ContextTracking.attachAt (anchor: step, context, subject: procedure, attachment), asked by Relay.ContextOperations.AttachContextNoteAtStep:context-procedure-and-step-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
then
  RequestBoundary.respond (attachment, requestId)
```

### Relay.ContextOperations.AttachContextNoteAtStep:context-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 91.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE_AT_STEP", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNoteAtStep
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.AttachContextNoteAtStep:procedure-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 91.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE_AT_STEP", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNoteAtStep
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.AttachContextNoteAtStep:step-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 91.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```reaction
when RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE_AT_STEP", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.AttachContextNoteAtStep
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  no ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  RequestBoundary.respond (error: "CONTEXT_PROCEDURE_OR_STEP_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.ChangeContextNote

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 102.
- Covered by [Relay](../design/compositions/Relay.md), line 162.

```reaction
when RequestBoundary.request (context, path: "/workspaces/context/change", requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CHANGE_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.ChangeContextNote:context-available#2

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 102.
- Covered by [Relay](../design/compositions/Relay.md), line 162.

```reaction
when RoleBasedAccessing.authorize (command: "CHANGE_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.ChangeContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/change", requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
then
  ContextTracking.change (context, text)
```

### Relay.ContextOperations.ChangeContextNote:context-available#3

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 102.
- Covered by [Relay](../design/compositions/Relay.md), line 162.

```reaction
when ContextTracking.change (context, text, change), asked by Relay.ContextOperations.ChangeContextNote:context-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/change", requestId, text, user, workspace)
then
  RequestBoundary.respond (change, context, requestId)
```

### Relay.ContextOperations.ChangeContextNote:context-unavailable#2

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 102.
- Covered by [Relay](../design/compositions/Relay.md), line 162.

```reaction
when RoleBasedAccessing.authorize (command: "CHANGE_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.ChangeContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/change", requestId, text, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "CONTEXT_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.CorrectContextNote

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 100.
- Covered by [Relay](../design/compositions/Relay.md), line 161.

```reaction
when RequestBoundary.request (context, path: "/workspaces/context/correct", requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CORRECT_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.CorrectContextNote:context-available#2

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 100.
- Covered by [Relay](../design/compositions/Relay.md), line 161.

```reaction
when RoleBasedAccessing.authorize (command: "CORRECT_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.CorrectContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/correct", requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
then
  ContextTracking.correct (context, text)
```

### Relay.ContextOperations.CorrectContextNote:context-available#3

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 100.
- Covered by [Relay](../design/compositions/Relay.md), line 161.

```reaction
when ContextTracking.correct (context, text), asked by Relay.ContextOperations.CorrectContextNote:context-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/correct", requestId, text, user, workspace)
then
  RequestBoundary.respond (context, requestId)
```

### Relay.ContextOperations.CorrectContextNote:context-unavailable#2

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 100.
- Covered by [Relay](../design/compositions/Relay.md), line 161.

```reaction
when RoleBasedAccessing.authorize (command: "CORRECT_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.CorrectContextNote
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/correct", requestId, text, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "CONTEXT_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.RecordContextNote

Authored path: `Relay.ContextOperations.RecordContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 88.
- Covered by [Relay](../design/compositions/Relay.md), line 158.

```reaction
when RequestBoundary.request (path: "/workspaces/context/notes", requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "RECORD_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.RecordContextNote#2

Authored path: `Relay.ContextOperations.RecordContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 88.
- Covered by [Relay](../design/compositions/Relay.md), line 158.

```reaction
when RoleBasedAccessing.authorize (command: "RECORD_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.RecordContextNote
where
  earlier, RequestBoundary.request (path: "/workspaces/context/notes", requestId, text, user, workspace)
then
  ContextTracking.record (scope: workspace, text)
```

### Relay.ContextOperations.RecordContextNote#3

Authored path: `Relay.ContextOperations.RecordContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 88.
- Covered by [Relay](../design/compositions/Relay.md), line 158.

```reaction
when ContextTracking.record (scope: workspace, text, context), asked by Relay.ContextOperations.RecordContextNote#2
where
  earlier, RequestBoundary.request (path: "/workspaces/context/notes", requestId, text, user, workspace)
then
  RequestBoundary.respond (context, requestId)
```

### Relay.ProcedureOperations.AddStep

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 81.

```reaction
when RequestBoundary.request (path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ADD_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.AddStep:procedure-available#2

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 81.

```reaction
when RoleBasedAccessing.authorize (command: "ADD_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.AddStep
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ProcedureMaintaining.addStep (procedure, text)
```

### Relay.ProcedureOperations.AddStep:procedure-available#3

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 81.

```reaction
when ProcedureMaintaining.addStep (procedure, text, step), asked by Relay.ProcedureOperations.AddStep:procedure-available#2
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
then
  RequestBoundary.respond (procedure, requestId, step)
```

### Relay.ProcedureOperations.AddStep:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 81.

```reaction
when RoleBasedAccessing.authorize (command: "ADD_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.AddStep
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.ArchiveProcedure

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 70.
- Covered by [Relay](../design/compositions/Relay.md), line 82.

```reaction
when RequestBoundary.request (path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ARCHIVE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.ArchiveProcedure:procedure-available#2

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 70.
- Covered by [Relay](../design/compositions/Relay.md), line 82.

```reaction
when RoleBasedAccessing.authorize (command: "ARCHIVE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.ArchiveProcedure
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ProcedureMaintaining.retire (procedure)
```

### Relay.ProcedureOperations.ArchiveProcedure:procedure-available#3

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 70.
- Covered by [Relay](../design/compositions/Relay.md), line 82.

```reaction
when ProcedureMaintaining.retire (procedure), asked by Relay.ProcedureOperations.ArchiveProcedure:procedure-available#2
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
then
  RequestBoundary.respond (procedure, requestId, status: "RETIRED")
```

### Relay.ProcedureOperations.ArchiveProcedure:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 70.
- Covered by [Relay](../design/compositions/Relay.md), line 82.

```reaction
when RoleBasedAccessing.authorize (command: "ARCHIVE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.ArchiveProcedure
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.CreateProcedure

Authored path: `Relay.ProcedureOperations.CreateProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 62.
- Covered by [Relay](../design/compositions/Relay.md), line 80.

```reaction
when RequestBoundary.request (path: "/workspaces/procedures/create", requestId, title, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CREATE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.CreateProcedure#2

Authored path: `Relay.ProcedureOperations.CreateProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 62.
- Covered by [Relay](../design/compositions/Relay.md), line 80.

```reaction
when RoleBasedAccessing.authorize (command: "CREATE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.CreateProcedure
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/create", requestId, title, user, workspace)
then
  ProcedureMaintaining.create (space: workspace, title)
```

### Relay.ProcedureOperations.CreateProcedure#3

Authored path: `Relay.ProcedureOperations.CreateProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 62.
- Covered by [Relay](../design/compositions/Relay.md), line 80.

```reaction
when ProcedureMaintaining.create (space: workspace, title, procedure), asked by Relay.ProcedureOperations.CreateProcedure#2
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/create", requestId, title, user, workspace)
then
  RequestBoundary.respond (procedure, requestId)
```

### Relay.ReadOperations.GetContextHistory

Authored path: `Relay.ReadOperations.GetContextHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 140.
- Covered by [Relay](../design/compositions/Relay.md), line 163.

```reaction
when RequestBoundary.request (path: "/workspaces/context", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_CONTEXT_HISTORY", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ReadOperations.GetContextHistory#2

Authored path: `Relay.ReadOperations.GetContextHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 140.
- Covered by [Relay](../design/compositions/Relay.md), line 163.

```reaction
when RoleBasedAccessing.authorize (command: "GET_CONTEXT_HISTORY", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ReadOperations.GetContextHistory
where
  earlier, RequestBoundary.request (path: "/workspaces/context", requestId, user, workspace)
then
  RequestBoundary.respond (contexts: former "Relay.Reads.WorkspaceContextHistory" with (workspace), requestId)
```

### Relay.ReadOperations.GetPendingReviews

Authored path: `Relay.ReadOperations.GetPendingReviews`.
- Covered by [Relay](../design/compositions/Relay.md), line 145.
- Covered by [Relay](../design/compositions/Relay.md), line 164.

```reaction
when RequestBoundary.request (path: "/workspaces/reviews/pending", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_PENDING_REVIEWS", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReadOperations.GetPendingReviews#2

Authored path: `Relay.ReadOperations.GetPendingReviews`.
- Covered by [Relay](../design/compositions/Relay.md), line 145.
- Covered by [Relay](../design/compositions/Relay.md), line 164.

```reaction
when RoleBasedAccessing.authorize (command: "GET_PENDING_REVIEWS", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReadOperations.GetPendingReviews
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews/pending", requestId, user, workspace)
then
  RequestBoundary.respond (requestId, reviews: former "Relay.Reads.PendingReviews" with (workspace))
```

### Relay.ReadOperations.GetReviewHistory

Authored path: `Relay.ReadOperations.GetReviewHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 151.
- Covered by [Relay](../design/compositions/Relay.md), line 165.

```reaction
when RequestBoundary.request (path: "/workspaces/reviews", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_REVIEW_HISTORY", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReadOperations.GetReviewHistory#2

Authored path: `Relay.ReadOperations.GetReviewHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 151.
- Covered by [Relay](../design/compositions/Relay.md), line 165.

```reaction
when RoleBasedAccessing.authorize (command: "GET_REVIEW_HISTORY", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReadOperations.GetReviewHistory
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews", requestId, user, workspace)
then
  RequestBoundary.respond (procedures: former "Relay.Reads.WorkspaceReviewHistory" with (workspace), requestId)
```

### Relay.ReadOperations.ListProcedures

Authored path: `Relay.ReadOperations.ListProcedures`.
- Covered by [Relay](../design/compositions/Relay.md), line 65.
- Covered by [Relay](../design/compositions/Relay.md), line 83.

```reaction
when RequestBoundary.request (path: "/workspaces/procedures", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "LIST_PROCEDURES", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ReadOperations.ListProcedures#2

Authored path: `Relay.ReadOperations.ListProcedures`.
- Covered by [Relay](../design/compositions/Relay.md), line 65.
- Covered by [Relay](../design/compositions/Relay.md), line 83.

```reaction
when RoleBasedAccessing.authorize (command: "LIST_PROCEDURES", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ReadOperations.ListProcedures
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures", requestId, user, workspace)
then
  RequestBoundary.respond (procedures: former "Relay.Reads.WorkspaceProcedures" with (workspace), requestId)
```

### Relay.ReviewOperations.ConfirmReview

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RequestBoundary.request (path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReviewOperations.ConfirmReview:procedure-outside-workspace#2

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ConfirmReview
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "PENDING")
  no ProcedureMaintaining._get (procedure) has (space: workspace)
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.ConfirmReview:review-in-workspace#2

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ConfirmReview
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "PENDING")
  ProcedureMaintaining._get (procedure) has (space: workspace)
then
  Reviewing.confirm (review)
```

### Relay.ReviewOperations.ConfirmReview:review-in-workspace#3

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when Reviewing.confirm (review), asked by Relay.ReviewOperations.ConfirmReview:review-in-workspace#2
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
then
  RequestBoundary.respond (requestId, review, status: "COMPLETE")
```

### Relay.ReviewOperations.ConfirmReview:review-unavailable#2

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ConfirmReview
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
  no Reviewing._get (review) has (item: procedure, status: "PENDING")
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/workspaces/context` — requires `user`, `workspace`
- `/workspaces/context/attachments` — requires `user`, `workspace`, `context`, `procedure`
- `/workspaces/context/change` — requires `user`, `workspace`, `context`, `text`
- `/workspaces/context/correct` — requires `user`, `workspace`, `context`, `text`
- `/workspaces/context/notes` — requires `user`, `workspace`, `text`
- `/workspaces/context/step-attachments` — requires `user`, `workspace`, `context`, `procedure`, `step`
- `/workspaces/procedures` — requires `user`, `workspace`
- `/workspaces/procedures/archive` — requires `user`, `workspace`, `procedure`
- `/workspaces/procedures/create` — requires `user`, `workspace`, `title`
- `/workspaces/procedures/steps/add` — requires `user`, `workspace`, `procedure`, `text`
- `/workspaces/reviews` — requires `user`, `workspace`
- `/workspaces/reviews/confirm` — requires `user`, `workspace`, `review`, `procedure`
- `/workspaces/reviews/pending` — requires `user`, `workspace`
