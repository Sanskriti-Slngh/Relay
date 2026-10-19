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
- `correct(context: ContextNote, text: String, expectedVersion?: Number) : returns ()`
  - Refuses `CONTEXT_NOT_FOUND`: There is no such ContextNote.
  - Refuses `VERSION_CONFLICT`: The ContextNote changed after it was loaded.
- `change(context: ContextNote, text: String, expectedVersion?: Number) : returns (change: Change)`
  - Refuses `CONTEXT_NOT_FOUND`: There is no such ContextNote.
  - Refuses `VERSION_CONFLICT`: The ContextNote changed after it was loaded.
  - Refuses `CHANGE_NOT_DIFFERENT`: The new text must differ from the current text.

#### Queries

- `_notes(scope: Scope) : many (context: ContextNote, text: String)`
- `_get(context: ContextNote) : optional (scope: Scope, text: String)`
- `_getVersion(context: ContextNote) : optional (version: Number)`
- `_attachments(context: ContextNote) : many (attachment: Attachment, subject: Subject, anchor?: Anchor)`
- `_getAttachment(attachment: Attachment) : optional (context: ContextNote, subject: Subject, anchor?: Anchor)`
- `_atAnchor(anchor: Anchor) : many (attachment: Attachment, context: ContextNote, subject: Subject)`
- `_changes(context: ContextNote) : many (change: Change, before: String, after: String)`
- `_getChange(change: Change) : optional (context: ContextNote, before: String, after: String)`

#### Instances

- `ContextTracking` — instance of `ContextTracking` — [Relay MVP Application Types](../design/types.md), line 42.
  - `Anchor` is `ProcedureMaintaining.Step` — [Relay MVP Application Types](../design/types.md), line 45.
  - `Scope` is `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 43.
  - `Subject` is `ProcedureMaintaining.Procedure` — [Relay MVP Application Types](../design/types.md), line 44.

### ProcedureMaintaining

Defined in [ProcedureMaintaining](../design/concepts/ProcedureMaintaining.md), line 1.

#### Actions

- `create(space: Space, title: String) : returns (procedure: Procedure)`
- `addStep(procedure: Procedure, text: String, expectedVersion?: Number) : returns (step: Step)`
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Procedure is retired.
  - Refuses `VERSION_CONFLICT`: The Procedure changed after it was loaded.
- `editStep(step: Step, text: String, expectedVersion?: Number) : returns ()`
  - Refuses `STEP_NOT_FOUND`: There is no such Step.
  - Refuses `STEP_NOT_ACTIVE`: The Step has been removed.
  - Refuses `VERSION_CONFLICT`: The Step changed after it was loaded.
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Step's Procedure is retired.
- `moveStep(step: Step, position: Number, expectedVersion?: Number) : returns ()`
  - Refuses `STEP_NOT_FOUND`: There is no such Step.
  - Refuses `STEP_NOT_ACTIVE`: The Step has been removed.
  - Refuses `VERSION_CONFLICT`: The Procedure changed after it was loaded.
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Step's Procedure is retired.
  - Refuses `INVALID_POSITION`: Position must be an integer within the active Step order.
- `removeStep(step: Step, expectedVersion?: Number) : returns ()`
  - Refuses `STEP_NOT_FOUND`: There is no such Step.
  - Refuses `STEP_NOT_ACTIVE`: The Step has been removed.
  - Refuses `VERSION_CONFLICT`: The Procedure changed after it was loaded.
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Step's Procedure is retired.
- `rename(procedure: Procedure, title: String, expectedVersion?: Number) : returns ()`
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Procedure is retired.
  - Refuses `VERSION_CONFLICT`: The Procedure changed after it was loaded.
- `retire(procedure: Procedure, expectedVersion?: Number) : returns ()`
  - Refuses `PROCEDURE_NOT_FOUND`: There is no such Procedure.
  - Refuses `PROCEDURE_NOT_ACTIVE`: The Procedure is already retired.
  - Refuses `VERSION_CONFLICT`: The Procedure changed after it was loaded.

#### Queries

- `_procedures(space: Space) : many (procedure: Procedure, title: String, status: ProcedureStatus)`
- `_get(procedure: Procedure) : optional (space: Space, title: String, status: ProcedureStatus)`
- `_steps(procedure: Procedure) : many (step: Step, text: String, position: Number)`
- `_getStep(step: Step) : optional (procedure: Procedure, text: String, status: StepStatus)`
- `_getVersion(procedure: Procedure) : optional (version: Number)`
- `_getStepVersion(step: Step) : optional (version: Number)`

#### Instances

- `ProcedureMaintaining` — instance of `ProcedureMaintaining` — [Relay MVP Application Types](../design/types.md), line 39.
  - `Space` is `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 40.

### Questioning

Defined in [Questioning](../design/concepts/Questioning.md), line 1.

#### Actions

- `ask(subject: Subject, text: String) : returns (question: Question)`
- `answer(question: Question, answer: String, answerer: Answerer, expectedVersion?: Number) : returns ()`
  - Refuses `QUESTION_NOT_FOUND`: There is no such Question.
  - Refuses `QUESTION_NOT_OPEN`: Only an OPEN Question can be answered.
  - Refuses `VERSION_CONFLICT`: The Question changed after it was loaded.
- `reviseAnswer(question: Question, answer: String, answerer: Answerer, expectedVersion?: Number) : returns ()`
  - Refuses `QUESTION_NOT_FOUND`: There is no such Question.
  - Refuses `VERSION_CONFLICT`: The Question changed after it was loaded.
  - Refuses `QUESTION_ANSWER_NOT_EDITABLE`: Only the original answerer can revise an ANSWERED Question.

#### Queries

- `_forSubject(subject: Subject) : many (question: Question, text: String, status: QuestionStatus, answer?: String, answerer?: Answerer)`
- `_open() : many (question: Question, subject: Subject, text: String)`
- `_questions() : many (question: Question, subject: Subject, text: String, status: QuestionStatus, answer?: String, answerer?: Answerer)`
- `_get(question: Question) : optional (subject: Subject, text: String, status: QuestionStatus, answer?: String, answerer?: Answerer)`
- `_getVersion(question: Question) : optional (version: Number)`

#### Instances

- `ContextQuestioning` — instance of `Questioning` — [Relay MVP Application Types](../design/types.md), line 51.
  - `Answerer` is `User` — [Relay MVP Application Types](../design/types.md), line 53.
  - `Subject` is `ContextTracking.ContextNote` — [Relay MVP Application Types](../design/types.md), line 52.
- `StepQuestioning` — instance of `Questioning` — [Relay MVP Application Types](../design/types.md), line 47.
  - `Answerer` is `User` — [Relay MVP Application Types](../design/types.md), line 49.
  - `Subject` is `ProcedureMaintaining.Step` — [Relay MVP Application Types](../design/types.md), line 48.

### Reviewing

Defined in [Reviewing](../design/concepts/Reviewing.md), line 1.

#### Actions

- `request(item: Item, cause: Cause) : returns (review: Review)`
  - Refuses `REQUEST_ALREADY_UNFINISHED`: This Item already has an unfinished Review; add the cause to that Review.
- `addCause(review: Review, cause: Cause) : returns ()`
  - Refuses `ADD_CAUSE_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `ADD_CAUSE_REVIEW_FINISHED`: Causes can only be added to an unfinished Review.
  - Refuses `CAUSE_ALREADY_PRESENT`: That cause is already associated with the Review.
- `confirm(review: Review, expectedVersion?: Number) : returns ()`
  - Refuses `CONFIRM_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `REVIEW_NOT_PENDING_FOR_CONFIRMATION`: Only a PENDING Review can be confirmed.
  - Refuses `VERSION_CONFLICT`: The Review changed after it was loaded.
- `requireChanges(review: Review, expectedVersion?: Number) : returns ()`
  - Refuses `REQUIRE_CHANGES_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `REVIEW_NOT_PENDING_FOR_CHANGES`: Only a PENDING Review can be marked as requiring changes.
  - Refuses `VERSION_CONFLICT`: The Review changed after it was loaded.
- `resolve(review: Review, expectedVersion?: Number) : returns ()`
  - Refuses `RESOLVE_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `REVIEW_NOT_AWAITING_CHANGES`: Only a Review requiring changes can be resolved.
  - Refuses `VERSION_CONFLICT`: The Review changed after it was loaded.
- `cancel(review: Review, expectedVersion?: Number) : returns ()`
  - Refuses `CANCEL_REVIEW_NOT_FOUND`: There is no such Review.
  - Refuses `CANCEL_REVIEW_FINISHED`: Only an unfinished Review can be cancelled.
  - Refuses `VERSION_CONFLICT`: The Review changed after it was loaded.

#### Queries

- `_unfinished() : many (review: Review, item: Item, status: ReviewStatus)`
- `_forItem(item: Item) : many (review: Review, status: ReviewStatus)`
- `_get(review: Review) : optional (item: Item, status: ReviewStatus)`
- `_getVersion(review: Review) : optional (version: Number)`
- `_causes(review: Review) : many (cause: Cause)`

#### Instances

- `Reviewing` — instance of `Reviewing` — [Relay MVP Application Types](../design/types.md), line 55.
  - `Cause` is `ContextTracking.Change` — [Relay MVP Application Types](../design/types.md), line 57.
  - `Item` is `ProcedureMaintaining.Procedure` — [Relay MVP Application Types](../design/types.md), line 56.

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

- `RoleBasedAccessing` — instance of `RoleBasedAccessing` — [Relay MVP Application Types](../design/types.md), line 59.
  - `Command` is `Command` — [Relay MVP Application Types](../design/types.md), line 63.
  - `Permission` is `Permission` — [Relay MVP Application Types](../design/types.md), line 62.
  - `Resource` is `ClubWorkspace` — [Relay MVP Application Types](../design/types.md), line 61.
  - `User` is `User` — [Relay MVP Application Types](../design/types.md), line 60.

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
- Covered by [Relay](../design/compositions/Relay.md), line 165.

```former
Former "Relay.Reads.PendingReviews" — inputs (workspace); bindings (review, procedure, status, version, title, cause, before, after); promises exactly one record — forms:
  each Reviewing._unfinished () has (item: procedure, review, status)
    where ProcedureMaintaining._get (procedure) has (space: workspace, title)
    where Reviewing._getVersion (review) has (version)
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
      version
```

### Relay.Reads.WorkspaceContextHistory

Authored path: `Relay.Reads.WorkspaceContextHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 160.

```former
Former "Relay.Reads.WorkspaceContextHistory" — inputs (workspace); bindings (context, text, version, attachment, subject, anchor, change, before, after); promises exactly one record — forms:
  each ContextTracking._notes (scope: workspace) has (context, text)
    where ContextTracking._getVersion (context) has (version)
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
      version
```

### Relay.Reads.WorkspaceContextQuestions

Authored path: `Relay.Reads.WorkspaceContextQuestions`.
- Covered by [Relay](../design/compositions/Relay.md), line 262.

```former
Former "Relay.Reads.WorkspaceContextQuestions" — inputs (workspace); bindings (question, context, questionText, questionStatus, answer, answerer, contextText, version); promises exactly one record — forms:
  each ContextQuestioning._questions () has (question, status: questionStatus, subject: context, text: questionText)
    where ContextTracking._get (context) has (scope: workspace, text: contextText)
    where whether ContextQuestioning._get (question) has (answer)
    where whether ContextQuestioning._get (question) has (answerer)
    where ContextQuestioning._getVersion (question) has (version)
    arranged by question
    form a record of
      answer
      answerer
      context
      question
      status: questionStatus
      subjectText: contextText
      text: questionText
      version
```

### Relay.Reads.WorkspaceProcedures

Authored path: `Relay.Reads.WorkspaceProcedures`.
- Covered by [Relay](../design/compositions/Relay.md), line 67.

```former
Former "Relay.Reads.WorkspaceProcedures" — inputs (workspace); bindings (procedure, title, status, version, step, text, position, stepVersion); promises exactly one record — forms:
  each ProcedureMaintaining._procedures (space: workspace) has (procedure, status, title)
    where ProcedureMaintaining._getVersion (procedure) has (version)
    arranged by procedure
    form a record of
      procedure
      status
      steps: each ProcedureMaintaining._steps (procedure) has (position, step, text)
        where ProcedureMaintaining._getStepVersion (step) has (version: stepVersion)
        arranged by position
        form a record of
          position
          step
          text
          version: stepVersion
      title
      version
```

### Relay.Reads.WorkspaceReviewHistory

Authored path: `Relay.Reads.WorkspaceReviewHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 171.

```former
Former "Relay.Reads.WorkspaceReviewHistory" — inputs (workspace); bindings (procedure, title, review, status, version, cause, before, after); promises exactly one record — forms:
  each ProcedureMaintaining._procedures (space: workspace) has (procedure, title)
    arranged by procedure
    form a record of
      procedure
      reviews: each Reviewing._forItem (item: procedure) has (review, status)
        where Reviewing._getVersion (review) has (version)
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
          version
      title
```

### Relay.Reads.WorkspaceStepQuestions

Authored path: `Relay.Reads.WorkspaceStepQuestions`.
- Covered by [Relay](../design/compositions/Relay.md), line 261.

```former
Former "Relay.Reads.WorkspaceStepQuestions" — inputs (workspace); bindings (question, step, questionText, questionStatus, answer, answerer, procedure, title, stepText, stepStatus, version); promises exactly one record — forms:
  each StepQuestioning._questions () has (question, status: questionStatus, subject: step, text: questionText)
    where ProcedureMaintaining._getStep (step) has (procedure, status: stepStatus, text: stepText)
    where ProcedureMaintaining._get (procedure) has (space: workspace, title)
    where whether StepQuestioning._get (question) has (answer)
    where whether StepQuestioning._get (question) has (answerer)
    where StepQuestioning._getVersion (question) has (version)
    arranged by question
    form a record of
      answer
      answerer
      procedure
      question
      status: questionStatus
      step
      subjectStatus: stepStatus
      subjectText: stepText
      text: questionText
      title
      version
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
- Covered by [Relay](../design/compositions/Relay.md), line 132.

```reaction
when refused Reviewing.request (cause, item, error: "REQUEST_ALREADY_UNFINISHED")
where
  Reviewing._unfinished () has (item, review)
then
  Reviewing.addCause (cause, review)
```

### Relay.ContextChanges.AddChangeCause

Authored path: `Relay.ContextChanges.AddChangeCause`.
- Covered by [Relay](../design/compositions/Relay.md), line 127.

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
- Covered by [Relay](../design/compositions/Relay.md), line 125.

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
- Covered by [Relay](../design/compositions/Relay.md), line 108.
- Covered by [Relay](../design/compositions/Relay.md), line 178.

```reaction
when RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.AttachContextNote:context-and-procedure-available#2

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 108.
- Covered by [Relay](../design/compositions/Relay.md), line 178.

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
- Covered by [Relay](../design/compositions/Relay.md), line 108.
- Covered by [Relay](../design/compositions/Relay.md), line 178.

```reaction
when ContextTracking.attach (context, subject: procedure, attachment), asked by Relay.ContextOperations.AttachContextNote:context-and-procedure-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/attachments", procedure, requestId, user, workspace)
then
  RequestBoundary.respond (attachment, requestId)
```

### Relay.ContextOperations.AttachContextNote:context-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 108.
- Covered by [Relay](../design/compositions/Relay.md), line 178.

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
- Covered by [Relay](../design/compositions/Relay.md), line 108.
- Covered by [Relay](../design/compositions/Relay.md), line 178.

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
- Covered by [Relay](../design/compositions/Relay.md), line 110.
- Covered by [Relay](../design/compositions/Relay.md), line 179.

```reaction
when RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ATTACH_CONTEXT_NOTE_AT_STEP", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.AttachContextNoteAtStep:context-procedure-and-step-available#2

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 110.
- Covered by [Relay](../design/compositions/Relay.md), line 179.

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
- Covered by [Relay](../design/compositions/Relay.md), line 110.
- Covered by [Relay](../design/compositions/Relay.md), line 179.

```reaction
when ContextTracking.attachAt (anchor: step, context, subject: procedure, attachment), asked by Relay.ContextOperations.AttachContextNoteAtStep:context-procedure-and-step-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/context/step-attachments", procedure, requestId, step, user, workspace)
then
  RequestBoundary.respond (attachment, requestId)
```

### Relay.ContextOperations.AttachContextNoteAtStep:context-unavailable#2

Authored path: `Relay.ContextOperations.AttachContextNoteAtStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 110.
- Covered by [Relay](../design/compositions/Relay.md), line 179.

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
- Covered by [Relay](../design/compositions/Relay.md), line 110.
- Covered by [Relay](../design/compositions/Relay.md), line 179.

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
- Covered by [Relay](../design/compositions/Relay.md), line 110.
- Covered by [Relay](../design/compositions/Relay.md), line 179.

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
- Covered by [Relay](../design/compositions/Relay.md), line 121.
- Covered by [Relay](../design/compositions/Relay.md), line 181.

```reaction
when RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/change", requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CHANGE_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.ChangeContextNote:context-available#2

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 121.
- Covered by [Relay](../design/compositions/Relay.md), line 181.

```reaction
when RoleBasedAccessing.authorize (command: "CHANGE_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.ChangeContextNote
where
  earlier, RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/change", requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
then
  ContextTracking.change (context, expectedVersion, text)
```

### Relay.ContextOperations.ChangeContextNote:context-available#3

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 121.
- Covered by [Relay](../design/compositions/Relay.md), line 181.

```reaction
when ContextTracking.change (context, expectedVersion, text, change), asked by Relay.ContextOperations.ChangeContextNote:context-available#2
where
  earlier, RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/change", requestId, text, user, workspace)
then
  RequestBoundary.respond (change, context, requestId)
```

### Relay.ContextOperations.ChangeContextNote:context-unavailable#2

Authored path: `Relay.ContextOperations.ChangeContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 121.
- Covered by [Relay](../design/compositions/Relay.md), line 181.

```reaction
when RoleBasedAccessing.authorize (command: "CHANGE_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.ChangeContextNote
where
  earlier, RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/change", requestId, text, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "CONTEXT_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.CorrectContextNote

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 119.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/correct", requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CORRECT_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.CorrectContextNote:context-available#2

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 119.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RoleBasedAccessing.authorize (command: "CORRECT_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.CorrectContextNote
where
  earlier, RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/correct", requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
then
  ContextTracking.correct (context, expectedVersion, text)
```

### Relay.ContextOperations.CorrectContextNote:context-available#3

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 119.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when ContextTracking.correct (context, expectedVersion, text), asked by Relay.ContextOperations.CorrectContextNote:context-available#2
where
  earlier, RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/correct", requestId, text, user, workspace)
then
  RequestBoundary.respond (context, requestId)
```

### Relay.ContextOperations.CorrectContextNote:context-unavailable#2

Authored path: `Relay.ContextOperations.CorrectContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 119.
- Covered by [Relay](../design/compositions/Relay.md), line 180.

```reaction
when RoleBasedAccessing.authorize (command: "CORRECT_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.CorrectContextNote
where
  earlier, RequestBoundary.request (context, expectedVersion, path: "/workspaces/context/correct", requestId, text, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "CONTEXT_NOT_AVAILABLE", requestId)
```

### Relay.ContextOperations.RecordContextNote

Authored path: `Relay.ContextOperations.RecordContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 107.
- Covered by [Relay](../design/compositions/Relay.md), line 177.

```reaction
when RequestBoundary.request (path: "/workspaces/context/notes", requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "RECORD_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user)
```

### Relay.ContextOperations.RecordContextNote#2

Authored path: `Relay.ContextOperations.RecordContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 107.
- Covered by [Relay](../design/compositions/Relay.md), line 177.

```reaction
when RoleBasedAccessing.authorize (command: "RECORD_CONTEXT_NOTE", permission: "EDIT_CONTEXT", resource: workspace, user), asked by Relay.ContextOperations.RecordContextNote
where
  earlier, RequestBoundary.request (path: "/workspaces/context/notes", requestId, text, user, workspace)
then
  ContextTracking.record (scope: workspace, text)
```

### Relay.ContextOperations.RecordContextNote#3

Authored path: `Relay.ContextOperations.RecordContextNote`.
- Covered by [Relay](../design/compositions/Relay.md), line 107.
- Covered by [Relay](../design/compositions/Relay.md), line 177.

```reaction
when ContextTracking.record (scope: workspace, text, context), asked by Relay.ContextOperations.RecordContextNote#2
where
  earlier, RequestBoundary.request (path: "/workspaces/context/notes", requestId, text, user, workspace)
then
  RequestBoundary.respond (context, requestId)
```

### Relay.ProcedureOperations.AddStep

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 64.
- Covered by [Relay](../design/compositions/Relay.md), line 96.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ADD_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.AddStep:procedure-available#2

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 64.
- Covered by [Relay](../design/compositions/Relay.md), line 96.

```reaction
when RoleBasedAccessing.authorize (command: "ADD_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.AddStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ProcedureMaintaining.addStep (expectedVersion, procedure, text)
```

### Relay.ProcedureOperations.AddStep:procedure-available#3

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 64.
- Covered by [Relay](../design/compositions/Relay.md), line 96.

```reaction
when ProcedureMaintaining.addStep (expectedVersion, procedure, text, step), asked by Relay.ProcedureOperations.AddStep:procedure-available#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
then
  RequestBoundary.respond (procedure, requestId, step)
```

### Relay.ProcedureOperations.AddStep:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.AddStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 64.
- Covered by [Relay](../design/compositions/Relay.md), line 96.

```reaction
when RoleBasedAccessing.authorize (command: "ADD_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.AddStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/add", procedure, requestId, text, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.ArchiveProcedure

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 85.
- Covered by [Relay](../design/compositions/Relay.md), line 101.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ARCHIVE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.ArchiveProcedure:procedure-available#2

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 85.
- Covered by [Relay](../design/compositions/Relay.md), line 101.

```reaction
when RoleBasedAccessing.authorize (command: "ARCHIVE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.ArchiveProcedure
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ProcedureMaintaining.retire (expectedVersion, procedure)
```

### Relay.ProcedureOperations.ArchiveProcedure:procedure-available#3

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 85.
- Covered by [Relay](../design/compositions/Relay.md), line 101.

```reaction
when ProcedureMaintaining.retire (expectedVersion, procedure), asked by Relay.ProcedureOperations.ArchiveProcedure:procedure-available#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
then
  RequestBoundary.respond (procedure, requestId, status: "RETIRED")
```

### Relay.ProcedureOperations.ArchiveProcedure:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.ArchiveProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 85.
- Covered by [Relay](../design/compositions/Relay.md), line 101.

```reaction
when RoleBasedAccessing.authorize (command: "ARCHIVE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.ArchiveProcedure
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/archive", procedure, requestId, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.CreateProcedure

Authored path: `Relay.ProcedureOperations.CreateProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 95.

```reaction
when RequestBoundary.request (path: "/workspaces/procedures/create", requestId, title, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CREATE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.CreateProcedure#2

Authored path: `Relay.ProcedureOperations.CreateProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 95.

```reaction
when RoleBasedAccessing.authorize (command: "CREATE_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.CreateProcedure
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/create", requestId, title, user, workspace)
then
  ProcedureMaintaining.create (space: workspace, title)
```

### Relay.ProcedureOperations.CreateProcedure#3

Authored path: `Relay.ProcedureOperations.CreateProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 63.
- Covered by [Relay](../design/compositions/Relay.md), line 95.

```reaction
when ProcedureMaintaining.create (space: workspace, title, procedure), asked by Relay.ProcedureOperations.CreateProcedure#2
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures/create", requestId, title, user, workspace)
then
  RequestBoundary.respond (procedure, requestId)
```

### Relay.ProcedureOperations.EditStep

Authored path: `Relay.ProcedureOperations.EditStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 72.
- Covered by [Relay](../design/compositions/Relay.md), line 98.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/edit", procedure, requestId, step, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "EDIT_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.EditStep:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.EditStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 72.
- Covered by [Relay](../design/compositions/Relay.md), line 98.

```reaction
when RoleBasedAccessing.authorize (command: "EDIT_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.EditStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/edit", procedure, requestId, step, text, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "STEP_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.EditStep:step-available#2

Authored path: `Relay.ProcedureOperations.EditStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 72.
- Covered by [Relay](../design/compositions/Relay.md), line 98.

```reaction
when RoleBasedAccessing.authorize (command: "EDIT_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.EditStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/edit", procedure, requestId, step, text, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  ProcedureMaintaining.editStep (expectedVersion, step, text)
```

### Relay.ProcedureOperations.EditStep:step-available#3

Authored path: `Relay.ProcedureOperations.EditStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 72.
- Covered by [Relay](../design/compositions/Relay.md), line 98.

```reaction
when ProcedureMaintaining.editStep (expectedVersion, step, text), asked by Relay.ProcedureOperations.EditStep:step-available#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/edit", procedure, requestId, step, text, user, workspace)
then
  RequestBoundary.respond (requestId, step)
```

### Relay.ProcedureOperations.EditStep:step-unavailable#2

Authored path: `Relay.ProcedureOperations.EditStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 72.
- Covered by [Relay](../design/compositions/Relay.md), line 98.

```reaction
when RoleBasedAccessing.authorize (command: "EDIT_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.EditStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/edit", procedure, requestId, step, text, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  no ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  RequestBoundary.respond (error: "STEP_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.MoveStep

Authored path: `Relay.ProcedureOperations.MoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 73.
- Covered by [Relay](../design/compositions/Relay.md), line 99.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/move", position, procedure, requestId, step, user, workspace)
then
  RoleBasedAccessing.authorize (command: "MOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.MoveStep:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.MoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 73.
- Covered by [Relay](../design/compositions/Relay.md), line 99.

```reaction
when RoleBasedAccessing.authorize (command: "MOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.MoveStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/move", position, procedure, requestId, step, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "STEP_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.MoveStep:step-available#2

Authored path: `Relay.ProcedureOperations.MoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 73.
- Covered by [Relay](../design/compositions/Relay.md), line 99.

```reaction
when RoleBasedAccessing.authorize (command: "MOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.MoveStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/move", position, procedure, requestId, step, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  ProcedureMaintaining.moveStep (expectedVersion, position, step)
```

### Relay.ProcedureOperations.MoveStep:step-available#3

Authored path: `Relay.ProcedureOperations.MoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 73.
- Covered by [Relay](../design/compositions/Relay.md), line 99.

```reaction
when ProcedureMaintaining.moveStep (expectedVersion, position, step), asked by Relay.ProcedureOperations.MoveStep:step-available#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/move", position, procedure, requestId, step, user, workspace)
then
  RequestBoundary.respond (position, requestId, step)
```

### Relay.ProcedureOperations.MoveStep:step-unavailable#2

Authored path: `Relay.ProcedureOperations.MoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 73.
- Covered by [Relay](../design/compositions/Relay.md), line 99.

```reaction
when RoleBasedAccessing.authorize (command: "MOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.MoveStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/move", position, procedure, requestId, step, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  no ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  RequestBoundary.respond (error: "STEP_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.RemoveStep

Authored path: `Relay.ProcedureOperations.RemoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 74.
- Covered by [Relay](../design/compositions/Relay.md), line 100.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/remove", procedure, requestId, step, user, workspace)
then
  RoleBasedAccessing.authorize (command: "REMOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.RemoveStep:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.RemoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 74.
- Covered by [Relay](../design/compositions/Relay.md), line 100.

```reaction
when RoleBasedAccessing.authorize (command: "REMOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.RemoveStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/remove", procedure, requestId, step, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "STEP_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.RemoveStep:step-available#2

Authored path: `Relay.ProcedureOperations.RemoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 74.
- Covered by [Relay](../design/compositions/Relay.md), line 100.

```reaction
when RoleBasedAccessing.authorize (command: "REMOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.RemoveStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/remove", procedure, requestId, step, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  ProcedureMaintaining.removeStep (expectedVersion, step)
```

### Relay.ProcedureOperations.RemoveStep:step-available#3

Authored path: `Relay.ProcedureOperations.RemoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 74.
- Covered by [Relay](../design/compositions/Relay.md), line 100.

```reaction
when ProcedureMaintaining.removeStep (expectedVersion, step), asked by Relay.ProcedureOperations.RemoveStep:step-available#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/remove", procedure, requestId, step, user, workspace)
then
  RequestBoundary.respond (requestId, step)
```

### Relay.ProcedureOperations.RemoveStep:step-unavailable#2

Authored path: `Relay.ProcedureOperations.RemoveStep`.
- Covered by [Relay](../design/compositions/Relay.md), line 74.
- Covered by [Relay](../design/compositions/Relay.md), line 100.

```reaction
when RoleBasedAccessing.authorize (command: "REMOVE_STEP", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.RemoveStep
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/steps/remove", procedure, requestId, step, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  no ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  RequestBoundary.respond (error: "STEP_NOT_AVAILABLE", requestId)
```

### Relay.ProcedureOperations.RenameProcedure

Authored path: `Relay.ProcedureOperations.RenameProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 71.
- Covered by [Relay](../design/compositions/Relay.md), line 97.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/rename", procedure, requestId, title, user, workspace)
then
  RoleBasedAccessing.authorize (command: "RENAME_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user)
```

### Relay.ProcedureOperations.RenameProcedure:procedure-available#2

Authored path: `Relay.ProcedureOperations.RenameProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 71.
- Covered by [Relay](../design/compositions/Relay.md), line 97.

```reaction
when RoleBasedAccessing.authorize (command: "RENAME_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.RenameProcedure
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/rename", procedure, requestId, title, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ProcedureMaintaining.rename (expectedVersion, procedure, title)
```

### Relay.ProcedureOperations.RenameProcedure:procedure-available#3

Authored path: `Relay.ProcedureOperations.RenameProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 71.
- Covered by [Relay](../design/compositions/Relay.md), line 97.

```reaction
when ProcedureMaintaining.rename (expectedVersion, procedure, title), asked by Relay.ProcedureOperations.RenameProcedure:procedure-available#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/rename", procedure, requestId, title, user, workspace)
then
  RequestBoundary.respond (procedure, requestId, title)
```

### Relay.ProcedureOperations.RenameProcedure:procedure-unavailable#2

Authored path: `Relay.ProcedureOperations.RenameProcedure`.
- Covered by [Relay](../design/compositions/Relay.md), line 71.
- Covered by [Relay](../design/compositions/Relay.md), line 97.

```reaction
when RoleBasedAccessing.authorize (command: "RENAME_PROCEDURE", permission: "EDIT_PROCEDURE", resource: workspace, user), asked by Relay.ProcedureOperations.RenameProcedure
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/procedures/rename", procedure, requestId, title, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "PROCEDURE_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AnswerContextQuestion

Authored path: `Relay.QuestionOperations.AnswerContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 244.
- Covered by [Relay](../design/compositions/Relay.md), line 273.

```reaction
when RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/answer", question, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ANSWER_CONTEXT_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user)
```

### Relay.QuestionOperations.AnswerContextQuestion:question-in-workspace#2

Authored path: `Relay.QuestionOperations.AnswerContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 244.
- Covered by [Relay](../design/compositions/Relay.md), line 273.

```reaction
when RoleBasedAccessing.authorize (command: "ANSWER_CONTEXT_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AnswerContextQuestion
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/answer", question, requestId, user, workspace)
  ContextQuestioning._get (question) has (status: "OPEN", subject: context)
  ContextTracking._get (context) has (scope: workspace)
then
  ContextQuestioning.answer (answer, answerer: user, expectedVersion, question)
```

### Relay.QuestionOperations.AnswerContextQuestion:question-in-workspace#3

Authored path: `Relay.QuestionOperations.AnswerContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 244.
- Covered by [Relay](../design/compositions/Relay.md), line 273.

```reaction
when ContextQuestioning.answer (answer, answerer: user, expectedVersion, question), asked by Relay.QuestionOperations.AnswerContextQuestion:question-in-workspace#2
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/answer", question, requestId, user, workspace)
then
  RequestBoundary.respond (question, requestId, status: "ANSWERED")
```

### Relay.QuestionOperations.AnswerContextQuestion:question-outside-workspace#2

Authored path: `Relay.QuestionOperations.AnswerContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 244.
- Covered by [Relay](../design/compositions/Relay.md), line 273.

```reaction
when RoleBasedAccessing.authorize (command: "ANSWER_CONTEXT_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AnswerContextQuestion
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/answer", question, requestId, user, workspace)
  ContextQuestioning._get (question) has (status: "OPEN", subject: context)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AnswerContextQuestion:question-unavailable#2

Authored path: `Relay.QuestionOperations.AnswerContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 244.
- Covered by [Relay](../design/compositions/Relay.md), line 273.

```reaction
when RoleBasedAccessing.authorize (command: "ANSWER_CONTEXT_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AnswerContextQuestion
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/answer", question, requestId, user, workspace)
  no ContextQuestioning._get (question) has (status: "OPEN")
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AnswerStepQuestion

Authored path: `Relay.QuestionOperations.AnswerStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 243.
- Covered by [Relay](../design/compositions/Relay.md), line 272.

```reaction
when RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/answer", question, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ANSWER_STEP_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user)
```

### Relay.QuestionOperations.AnswerStepQuestion:question-in-workspace#2

Authored path: `Relay.QuestionOperations.AnswerStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 243.
- Covered by [Relay](../design/compositions/Relay.md), line 272.

```reaction
when RoleBasedAccessing.authorize (command: "ANSWER_STEP_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AnswerStepQuestion
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/answer", question, requestId, user, workspace)
  StepQuestioning._get (question) has (status: "OPEN", subject: step)
  ProcedureMaintaining._getStep (step) has (procedure)
  ProcedureMaintaining._get (procedure) has (space: workspace)
then
  StepQuestioning.answer (answer, answerer: user, expectedVersion, question)
```

### Relay.QuestionOperations.AnswerStepQuestion:question-in-workspace#3

Authored path: `Relay.QuestionOperations.AnswerStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 243.
- Covered by [Relay](../design/compositions/Relay.md), line 272.

```reaction
when StepQuestioning.answer (answer, answerer: user, expectedVersion, question), asked by Relay.QuestionOperations.AnswerStepQuestion:question-in-workspace#2
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/answer", question, requestId, user, workspace)
then
  RequestBoundary.respond (question, requestId, status: "ANSWERED")
```

### Relay.QuestionOperations.AnswerStepQuestion:question-outside-workspace#2

Authored path: `Relay.QuestionOperations.AnswerStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 243.
- Covered by [Relay](../design/compositions/Relay.md), line 272.

```reaction
when RoleBasedAccessing.authorize (command: "ANSWER_STEP_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AnswerStepQuestion
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/answer", question, requestId, user, workspace)
  StepQuestioning._get (question) has (status: "OPEN", subject: step)
  ProcedureMaintaining._getStep (step) has (procedure)
  no ProcedureMaintaining._get (procedure) has (space: workspace)
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AnswerStepQuestion:question-unavailable#2

Authored path: `Relay.QuestionOperations.AnswerStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 243.
- Covered by [Relay](../design/compositions/Relay.md), line 272.

```reaction
when RoleBasedAccessing.authorize (command: "ANSWER_STEP_QUESTION", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AnswerStepQuestion
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/answer", question, requestId, user, workspace)
  no StepQuestioning._get (question) has (status: "OPEN")
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AskContextQuestion

Authored path: `Relay.QuestionOperations.AskContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 238.
- Covered by [Relay](../design/compositions/Relay.md), line 271.

```reaction
when RequestBoundary.request (context, path: "/workspaces/questions/context/ask", procedure, requestId, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ASK_CONTEXT_QUESTION", permission: "ASK_QUESTION", resource: workspace, user)
```

### Relay.QuestionOperations.AskContextQuestion:attachment-unavailable#2

Authored path: `Relay.QuestionOperations.AskContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 238.
- Covered by [Relay](../design/compositions/Relay.md), line 271.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_CONTEXT_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskContextQuestion
where
  earlier, RequestBoundary.request (context, path: "/workspaces/questions/context/ask", procedure, requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  no ContextTracking._attachments (context) has (subject: procedure)
then
  RequestBoundary.respond (error: "QUESTION_SUBJECT_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AskContextQuestion:context-available#2

Authored path: `Relay.QuestionOperations.AskContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 238.
- Covered by [Relay](../design/compositions/Relay.md), line 271.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_CONTEXT_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskContextQuestion
where
  earlier, RequestBoundary.request (context, path: "/workspaces/questions/context/ask", procedure, requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  ContextTracking._attachments (context) has (subject: procedure)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  ContextQuestioning.ask (subject: context, text)
```

### Relay.QuestionOperations.AskContextQuestion:context-available#3

Authored path: `Relay.QuestionOperations.AskContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 238.
- Covered by [Relay](../design/compositions/Relay.md), line 271.

```reaction
when ContextQuestioning.ask (subject: context, text, question), asked by Relay.QuestionOperations.AskContextQuestion:context-available#2
where
  earlier, RequestBoundary.request (context, path: "/workspaces/questions/context/ask", procedure, requestId, text, user, workspace)
then
  RequestBoundary.respond (context, question, requestId)
```

### Relay.QuestionOperations.AskContextQuestion:context-unavailable#2

Authored path: `Relay.QuestionOperations.AskContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 238.
- Covered by [Relay](../design/compositions/Relay.md), line 271.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_CONTEXT_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskContextQuestion
where
  earlier, RequestBoundary.request (context, path: "/workspaces/questions/context/ask", procedure, requestId, text, user, workspace)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "QUESTION_SUBJECT_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AskContextQuestion:procedure-unavailable#2

Authored path: `Relay.QuestionOperations.AskContextQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 238.
- Covered by [Relay](../design/compositions/Relay.md), line 271.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_CONTEXT_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskContextQuestion
where
  earlier, RequestBoundary.request (context, path: "/workspaces/questions/context/ask", procedure, requestId, text, user, workspace)
  ContextTracking._get (context) has (scope: workspace)
  ContextTracking._attachments (context) has (subject: procedure)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "QUESTION_SUBJECT_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AskStepQuestion

Authored path: `Relay.QuestionOperations.AskStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 236.
- Covered by [Relay](../design/compositions/Relay.md), line 270.

```reaction
when RequestBoundary.request (path: "/workspaces/questions/steps/ask", procedure, requestId, step, text, user, workspace)
then
  RoleBasedAccessing.authorize (command: "ASK_STEP_QUESTION", permission: "ASK_QUESTION", resource: workspace, user)
```

### Relay.QuestionOperations.AskStepQuestion:procedure-unavailable#2

Authored path: `Relay.QuestionOperations.AskStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 236.
- Covered by [Relay](../design/compositions/Relay.md), line 270.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_STEP_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskStepQuestion
where
  earlier, RequestBoundary.request (path: "/workspaces/questions/steps/ask", procedure, requestId, step, text, user, workspace)
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "QUESTION_SUBJECT_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.AskStepQuestion:step-available#2

Authored path: `Relay.QuestionOperations.AskStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 236.
- Covered by [Relay](../design/compositions/Relay.md), line 270.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_STEP_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskStepQuestion
where
  earlier, RequestBoundary.request (path: "/workspaces/questions/steps/ask", procedure, requestId, step, text, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  StepQuestioning.ask (subject: step, text)
```

### Relay.QuestionOperations.AskStepQuestion:step-available#3

Authored path: `Relay.QuestionOperations.AskStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 236.
- Covered by [Relay](../design/compositions/Relay.md), line 270.

```reaction
when StepQuestioning.ask (subject: step, text, question), asked by Relay.QuestionOperations.AskStepQuestion:step-available#2
where
  earlier, RequestBoundary.request (path: "/workspaces/questions/steps/ask", procedure, requestId, step, text, user, workspace)
then
  RequestBoundary.respond (question, requestId, step)
```

### Relay.QuestionOperations.AskStepQuestion:step-unavailable#2

Authored path: `Relay.QuestionOperations.AskStepQuestion`.
- Covered by [Relay](../design/compositions/Relay.md), line 236.
- Covered by [Relay](../design/compositions/Relay.md), line 270.

```reaction
when RoleBasedAccessing.authorize (command: "ASK_STEP_QUESTION", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.AskStepQuestion
where
  earlier, RequestBoundary.request (path: "/workspaces/questions/steps/ask", procedure, requestId, step, text, user, workspace)
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
  no ProcedureMaintaining._getStep (step) has (procedure, status: "ACTIVE")
then
  RequestBoundary.respond (error: "QUESTION_SUBJECT_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.ReviseContextQuestionAnswer

Authored path: `Relay.QuestionOperations.ReviseContextQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 252.
- Covered by [Relay](../design/compositions/Relay.md), line 275.

```reaction
when RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/revise", question, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "REVISE_CONTEXT_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user)
```

### Relay.QuestionOperations.ReviseContextQuestionAnswer:answered-question-in-workspace#2

Authored path: `Relay.QuestionOperations.ReviseContextQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 252.
- Covered by [Relay](../design/compositions/Relay.md), line 275.

```reaction
when RoleBasedAccessing.authorize (command: "REVISE_CONTEXT_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.ReviseContextQuestionAnswer
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/revise", question, requestId, user, workspace)
  ContextQuestioning._get (question) has (status: "ANSWERED", subject: context)
  ContextTracking._get (context) has (scope: workspace)
then
  ContextQuestioning.reviseAnswer (answer, answerer: user, expectedVersion, question)
```

### Relay.QuestionOperations.ReviseContextQuestionAnswer:answered-question-in-workspace#3

Authored path: `Relay.QuestionOperations.ReviseContextQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 252.
- Covered by [Relay](../design/compositions/Relay.md), line 275.

```reaction
when ContextQuestioning.reviseAnswer (answer, answerer: user, expectedVersion, question), asked by Relay.QuestionOperations.ReviseContextQuestionAnswer:answered-question-in-workspace#2
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/revise", question, requestId, user, workspace)
then
  RequestBoundary.respond (question, requestId, status: "ANSWERED")
```

### Relay.QuestionOperations.ReviseContextQuestionAnswer:question-outside-workspace#2

Authored path: `Relay.QuestionOperations.ReviseContextQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 252.
- Covered by [Relay](../design/compositions/Relay.md), line 275.

```reaction
when RoleBasedAccessing.authorize (command: "REVISE_CONTEXT_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.ReviseContextQuestionAnswer
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/revise", question, requestId, user, workspace)
  ContextQuestioning._get (question) has (status: "ANSWERED", subject: context)
  no ContextTracking._get (context) has (scope: workspace)
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.ReviseContextQuestionAnswer:question-unavailable#2

Authored path: `Relay.QuestionOperations.ReviseContextQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 252.
- Covered by [Relay](../design/compositions/Relay.md), line 275.

```reaction
when RoleBasedAccessing.authorize (command: "REVISE_CONTEXT_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.ReviseContextQuestionAnswer
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/context/revise", question, requestId, user, workspace)
  no ContextQuestioning._get (question) has (status: "ANSWERED")
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.ReviseStepQuestionAnswer

Authored path: `Relay.QuestionOperations.ReviseStepQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 251.
- Covered by [Relay](../design/compositions/Relay.md), line 274.

```reaction
when RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/revise", question, requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "REVISE_STEP_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user)
```

### Relay.QuestionOperations.ReviseStepQuestionAnswer:answered-question-in-workspace#2

Authored path: `Relay.QuestionOperations.ReviseStepQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 251.
- Covered by [Relay](../design/compositions/Relay.md), line 274.

```reaction
when RoleBasedAccessing.authorize (command: "REVISE_STEP_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.ReviseStepQuestionAnswer
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/revise", question, requestId, user, workspace)
  StepQuestioning._get (question) has (status: "ANSWERED", subject: step)
  ProcedureMaintaining._getStep (step) has (procedure)
  ProcedureMaintaining._get (procedure) has (space: workspace)
then
  StepQuestioning.reviseAnswer (answer, answerer: user, expectedVersion, question)
```

### Relay.QuestionOperations.ReviseStepQuestionAnswer:answered-question-in-workspace#3

Authored path: `Relay.QuestionOperations.ReviseStepQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 251.
- Covered by [Relay](../design/compositions/Relay.md), line 274.

```reaction
when StepQuestioning.reviseAnswer (answer, answerer: user, expectedVersion, question), asked by Relay.QuestionOperations.ReviseStepQuestionAnswer:answered-question-in-workspace#2
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/revise", question, requestId, user, workspace)
then
  RequestBoundary.respond (question, requestId, status: "ANSWERED")
```

### Relay.QuestionOperations.ReviseStepQuestionAnswer:question-outside-workspace#2

Authored path: `Relay.QuestionOperations.ReviseStepQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 251.
- Covered by [Relay](../design/compositions/Relay.md), line 274.

```reaction
when RoleBasedAccessing.authorize (command: "REVISE_STEP_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.ReviseStepQuestionAnswer
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/revise", question, requestId, user, workspace)
  StepQuestioning._get (question) has (status: "ANSWERED", subject: step)
  ProcedureMaintaining._getStep (step) has (procedure)
  no ProcedureMaintaining._get (procedure) has (space: workspace)
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.QuestionOperations.ReviseStepQuestionAnswer:question-unavailable#2

Authored path: `Relay.QuestionOperations.ReviseStepQuestionAnswer`.
- Covered by [Relay](../design/compositions/Relay.md), line 251.
- Covered by [Relay](../design/compositions/Relay.md), line 274.

```reaction
when RoleBasedAccessing.authorize (command: "REVISE_STEP_QUESTION_ANSWER", permission: "ANSWER_QUESTION", resource: workspace, user), asked by Relay.QuestionOperations.ReviseStepQuestionAnswer
where
  earlier, RequestBoundary.request (answer, expectedVersion, path: "/workspaces/questions/steps/revise", question, requestId, user, workspace)
  no StepQuestioning._get (question) has (status: "ANSWERED")
then
  RequestBoundary.respond (error: "QUESTION_NOT_AVAILABLE", requestId)
```

### Relay.ReadOperations.GetContextHistory

Authored path: `Relay.ReadOperations.GetContextHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 159.
- Covered by [Relay](../design/compositions/Relay.md), line 182.

```reaction
when RequestBoundary.request (path: "/workspaces/context", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_CONTEXT_HISTORY", permission: "ASK_QUESTION", resource: workspace, user)
```

### Relay.ReadOperations.GetContextHistory#2

Authored path: `Relay.ReadOperations.GetContextHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 159.
- Covered by [Relay](../design/compositions/Relay.md), line 182.

```reaction
when RoleBasedAccessing.authorize (command: "GET_CONTEXT_HISTORY", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.ReadOperations.GetContextHistory
where
  earlier, RequestBoundary.request (path: "/workspaces/context", requestId, user, workspace)
then
  RequestBoundary.respond (contexts: former "Relay.Reads.WorkspaceContextHistory" with (workspace), requestId)
```

### Relay.ReadOperations.GetPendingReviews

Authored path: `Relay.ReadOperations.GetPendingReviews`.
- Covered by [Relay](../design/compositions/Relay.md), line 164.
- Covered by [Relay](../design/compositions/Relay.md), line 183.

```reaction
when RequestBoundary.request (path: "/workspaces/reviews/pending", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_PENDING_REVIEWS", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReadOperations.GetPendingReviews#2

Authored path: `Relay.ReadOperations.GetPendingReviews`.
- Covered by [Relay](../design/compositions/Relay.md), line 164.
- Covered by [Relay](../design/compositions/Relay.md), line 183.

```reaction
when RoleBasedAccessing.authorize (command: "GET_PENDING_REVIEWS", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReadOperations.GetPendingReviews
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews/pending", requestId, user, workspace)
then
  RequestBoundary.respond (requestId, reviews: former "Relay.Reads.PendingReviews" with (workspace))
```

### Relay.ReadOperations.GetQuestions

Authored path: `Relay.ReadOperations.GetQuestions`.
- Covered by [Relay](../design/compositions/Relay.md), line 260.
- Covered by [Relay](../design/compositions/Relay.md), line 276.

```reaction
when RequestBoundary.request (path: "/workspaces/questions", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_QUESTIONS", permission: "ASK_QUESTION", resource: workspace, user)
```

### Relay.ReadOperations.GetQuestions#2

Authored path: `Relay.ReadOperations.GetQuestions`.
- Covered by [Relay](../design/compositions/Relay.md), line 260.
- Covered by [Relay](../design/compositions/Relay.md), line 276.

```reaction
when RoleBasedAccessing.authorize (command: "GET_QUESTIONS", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.ReadOperations.GetQuestions
where
  earlier, RequestBoundary.request (path: "/workspaces/questions", requestId, user, workspace)
then
  RequestBoundary.respond (contextQuestions: former "Relay.Reads.WorkspaceContextQuestions" with (workspace), requestId, stepQuestions: former "Relay.Reads.WorkspaceStepQuestions" with (workspace))
```

### Relay.ReadOperations.GetReviewHistory

Authored path: `Relay.ReadOperations.GetReviewHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 184.

```reaction
when RequestBoundary.request (path: "/workspaces/reviews", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "GET_REVIEW_HISTORY", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReadOperations.GetReviewHistory#2

Authored path: `Relay.ReadOperations.GetReviewHistory`.
- Covered by [Relay](../design/compositions/Relay.md), line 170.
- Covered by [Relay](../design/compositions/Relay.md), line 184.

```reaction
when RoleBasedAccessing.authorize (command: "GET_REVIEW_HISTORY", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReadOperations.GetReviewHistory
where
  earlier, RequestBoundary.request (path: "/workspaces/reviews", requestId, user, workspace)
then
  RequestBoundary.respond (procedures: former "Relay.Reads.WorkspaceReviewHistory" with (workspace), requestId)
```

### Relay.ReadOperations.ListProcedures

Authored path: `Relay.ReadOperations.ListProcedures`.
- Covered by [Relay](../design/compositions/Relay.md), line 66.
- Covered by [Relay](../design/compositions/Relay.md), line 102.

```reaction
when RequestBoundary.request (path: "/workspaces/procedures", requestId, user, workspace)
then
  RoleBasedAccessing.authorize (command: "LIST_PROCEDURES", permission: "ASK_QUESTION", resource: workspace, user)
```

### Relay.ReadOperations.ListProcedures#2

Authored path: `Relay.ReadOperations.ListProcedures`.
- Covered by [Relay](../design/compositions/Relay.md), line 66.
- Covered by [Relay](../design/compositions/Relay.md), line 102.

```reaction
when RoleBasedAccessing.authorize (command: "LIST_PROCEDURES", permission: "ASK_QUESTION", resource: workspace, user), asked by Relay.ReadOperations.ListProcedures
where
  earlier, RequestBoundary.request (path: "/workspaces/procedures", requestId, user, workspace)
then
  RequestBoundary.respond (procedures: former "Relay.Reads.WorkspaceProcedures" with (workspace), requestId)
```

### Relay.ReviewOperations.CancelReview

Authored path: `Relay.ReviewOperations.CancelReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 214.
- Covered by [Relay](../design/compositions/Relay.md), line 225.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/cancel", procedure, requestId, review, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CANCEL_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReviewOperations.CancelReview:procedure-outside-workspace#2

Authored path: `Relay.ReviewOperations.CancelReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 214.
- Covered by [Relay](../design/compositions/Relay.md), line 225.

```reaction
when RoleBasedAccessing.authorize (command: "CANCEL_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.CancelReview
where
  Reviewing._unfinished () has (item: procedure, review)
  no ProcedureMaintaining._get (procedure) has (space: workspace)
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/cancel", procedure, requestId, review, user, workspace)
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.CancelReview:review-in-workspace#2

Authored path: `Relay.ReviewOperations.CancelReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 214.
- Covered by [Relay](../design/compositions/Relay.md), line 225.

```reaction
when RoleBasedAccessing.authorize (command: "CANCEL_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.CancelReview
where
  Reviewing._unfinished () has (item: procedure, review)
  ProcedureMaintaining._get (procedure) has (space: workspace)
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/cancel", procedure, requestId, review, user, workspace)
then
  Reviewing.cancel (expectedVersion, review)
```

### Relay.ReviewOperations.CancelReview:review-in-workspace#3

Authored path: `Relay.ReviewOperations.CancelReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 214.
- Covered by [Relay](../design/compositions/Relay.md), line 225.

```reaction
when Reviewing.cancel (expectedVersion, review), asked by Relay.ReviewOperations.CancelReview:review-in-workspace#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/cancel", procedure, requestId, review, user, workspace)
then
  RequestBoundary.respond (requestId, review, status: "CANCELLED")
```

### Relay.ReviewOperations.CancelReview:review-unavailable#2

Authored path: `Relay.ReviewOperations.CancelReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 214.
- Covered by [Relay](../design/compositions/Relay.md), line 225.

```reaction
when RoleBasedAccessing.authorize (command: "CANCEL_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.CancelReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/cancel", procedure, requestId, review, user, workspace)
  no Reviewing._unfinished () has (item: procedure, review)
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.ConfirmReview

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 189.
- Covered by [Relay](../design/compositions/Relay.md), line 199.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
then
  RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReviewOperations.ConfirmReview:procedure-outside-workspace#2

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 189.
- Covered by [Relay](../design/compositions/Relay.md), line 199.

```reaction
when RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ConfirmReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "PENDING")
  no ProcedureMaintaining._get (procedure) has (space: workspace)
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.ConfirmReview:review-in-workspace#2

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 189.
- Covered by [Relay](../design/compositions/Relay.md), line 199.

```reaction
when RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ConfirmReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "PENDING")
  ProcedureMaintaining._get (procedure) has (space: workspace)
then
  Reviewing.confirm (expectedVersion, review)
```

### Relay.ReviewOperations.ConfirmReview:review-in-workspace#3

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 189.
- Covered by [Relay](../design/compositions/Relay.md), line 199.

```reaction
when Reviewing.confirm (expectedVersion, review), asked by Relay.ReviewOperations.ConfirmReview:review-in-workspace#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
then
  RequestBoundary.respond (requestId, review, status: "COMPLETE")
```

### Relay.ReviewOperations.ConfirmReview:review-unavailable#2

Authored path: `Relay.ReviewOperations.ConfirmReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 189.
- Covered by [Relay](../design/compositions/Relay.md), line 199.

```reaction
when RoleBasedAccessing.authorize (command: "CONFIRM_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ConfirmReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/confirm", procedure, requestId, review, user, workspace)
  no Reviewing._get (review) has (item: procedure, status: "PENDING")
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.RequireReviewChanges

Authored path: `Relay.ReviewOperations.RequireReviewChanges`.
- Covered by [Relay](../design/compositions/Relay.md), line 204.
- Covered by [Relay](../design/compositions/Relay.md), line 223.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/require-changes", procedure, requestId, review, user, workspace)
then
  RoleBasedAccessing.authorize (command: "REQUIRE_REVIEW_CHANGES", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReviewOperations.RequireReviewChanges:procedure-unavailable#2

Authored path: `Relay.ReviewOperations.RequireReviewChanges`.
- Covered by [Relay](../design/compositions/Relay.md), line 204.
- Covered by [Relay](../design/compositions/Relay.md), line 223.

```reaction
when RoleBasedAccessing.authorize (command: "REQUIRE_REVIEW_CHANGES", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.RequireReviewChanges
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/require-changes", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "PENDING")
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.RequireReviewChanges:review-in-workspace#2

Authored path: `Relay.ReviewOperations.RequireReviewChanges`.
- Covered by [Relay](../design/compositions/Relay.md), line 204.
- Covered by [Relay](../design/compositions/Relay.md), line 223.

```reaction
when RoleBasedAccessing.authorize (command: "REQUIRE_REVIEW_CHANGES", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.RequireReviewChanges
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/require-changes", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "PENDING")
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  Reviewing.requireChanges (expectedVersion, review)
```

### Relay.ReviewOperations.RequireReviewChanges:review-in-workspace#3

Authored path: `Relay.ReviewOperations.RequireReviewChanges`.
- Covered by [Relay](../design/compositions/Relay.md), line 204.
- Covered by [Relay](../design/compositions/Relay.md), line 223.

```reaction
when Reviewing.requireChanges (expectedVersion, review), asked by Relay.ReviewOperations.RequireReviewChanges:review-in-workspace#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/require-changes", procedure, requestId, review, user, workspace)
then
  RequestBoundary.respond (requestId, review, status: "CHANGES_REQUIRED")
```

### Relay.ReviewOperations.RequireReviewChanges:review-unavailable#2

Authored path: `Relay.ReviewOperations.RequireReviewChanges`.
- Covered by [Relay](../design/compositions/Relay.md), line 204.
- Covered by [Relay](../design/compositions/Relay.md), line 223.

```reaction
when RoleBasedAccessing.authorize (command: "REQUIRE_REVIEW_CHANGES", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.RequireReviewChanges
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/require-changes", procedure, requestId, review, user, workspace)
  no Reviewing._get (review) has (item: procedure, status: "PENDING")
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.ResolveReview

Authored path: `Relay.ReviewOperations.ResolveReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 211.
- Covered by [Relay](../design/compositions/Relay.md), line 224.

```reaction
when RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/resolve", procedure, requestId, review, user, workspace)
then
  RoleBasedAccessing.authorize (command: "RESOLVE_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user)
```

### Relay.ReviewOperations.ResolveReview:procedure-unavailable#2

Authored path: `Relay.ReviewOperations.ResolveReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 211.
- Covered by [Relay](../design/compositions/Relay.md), line 224.

```reaction
when RoleBasedAccessing.authorize (command: "RESOLVE_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ResolveReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/resolve", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "CHANGES_REQUIRED")
  no ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.ReviewOperations.ResolveReview:review-in-workspace#2

Authored path: `Relay.ReviewOperations.ResolveReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 211.
- Covered by [Relay](../design/compositions/Relay.md), line 224.

```reaction
when RoleBasedAccessing.authorize (command: "RESOLVE_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ResolveReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/resolve", procedure, requestId, review, user, workspace)
  Reviewing._get (review) has (item: procedure, status: "CHANGES_REQUIRED")
  ProcedureMaintaining._get (procedure) has (space: workspace, status: "ACTIVE")
then
  Reviewing.resolve (expectedVersion, review)
```

### Relay.ReviewOperations.ResolveReview:review-in-workspace#3

Authored path: `Relay.ReviewOperations.ResolveReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 211.
- Covered by [Relay](../design/compositions/Relay.md), line 224.

```reaction
when Reviewing.resolve (expectedVersion, review), asked by Relay.ReviewOperations.ResolveReview:review-in-workspace#2
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/resolve", procedure, requestId, review, user, workspace)
then
  RequestBoundary.respond (requestId, review, status: "COMPLETE")
```

### Relay.ReviewOperations.ResolveReview:review-unavailable#2

Authored path: `Relay.ReviewOperations.ResolveReview`.
- Covered by [Relay](../design/compositions/Relay.md), line 211.
- Covered by [Relay](../design/compositions/Relay.md), line 224.

```reaction
when RoleBasedAccessing.authorize (command: "RESOLVE_REVIEW", permission: "COMPLETE_REVIEW", resource: workspace, user), asked by Relay.ReviewOperations.ResolveReview
where
  earlier, RequestBoundary.request (expectedVersion, path: "/workspaces/reviews/resolve", procedure, requestId, review, user, workspace)
  no Reviewing._get (review) has (item: procedure, status: "CHANGES_REQUIRED")
then
  RequestBoundary.respond (error: "REVIEW_NOT_AVAILABLE", requestId)
```

### Relay.StepRemoval.DetachRemovedStepContext

Authored path: `Relay.StepRemoval.DetachRemovedStepContext`.
- Covered by [Relay](../design/compositions/Relay.md), line 81.

```reaction
when ProcedureMaintaining.removeStep (step)
where
  ContextTracking._atAnchor (anchor: step) has (attachment)
then
  ContextTracking.detach (attachment)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/workspaces/context` — requires `user`, `workspace`
- `/workspaces/context/attachments` — requires `user`, `workspace`, `context`, `procedure`
- `/workspaces/context/change` — requires `user`, `workspace`, `context`, `text`, `expectedVersion`
- `/workspaces/context/correct` — requires `user`, `workspace`, `context`, `text`, `expectedVersion`
- `/workspaces/context/notes` — requires `user`, `workspace`, `text`
- `/workspaces/context/step-attachments` — requires `user`, `workspace`, `context`, `procedure`, `step`
- `/workspaces/procedures` — requires `user`, `workspace`
- `/workspaces/procedures/archive` — requires `user`, `workspace`, `procedure`, `expectedVersion`
- `/workspaces/procedures/create` — requires `user`, `workspace`, `title`
- `/workspaces/procedures/rename` — requires `user`, `workspace`, `procedure`, `title`, `expectedVersion`
- `/workspaces/procedures/steps/add` — requires `user`, `workspace`, `procedure`, `text`, `expectedVersion`
- `/workspaces/procedures/steps/edit` — requires `user`, `workspace`, `procedure`, `step`, `text`, `expectedVersion`
- `/workspaces/procedures/steps/move` — requires `user`, `workspace`, `procedure`, `step`, `position`, `expectedVersion`
- `/workspaces/procedures/steps/remove` — requires `user`, `workspace`, `procedure`, `step`, `expectedVersion`
- `/workspaces/questions` — requires `user`, `workspace`
- `/workspaces/questions/context/answer` — requires `user`, `workspace`, `question`, `answer`, `expectedVersion`
- `/workspaces/questions/context/ask` — requires `user`, `workspace`, `procedure`, `context`, `text`
- `/workspaces/questions/context/revise` — requires `user`, `workspace`, `question`, `answer`, `expectedVersion`
- `/workspaces/questions/steps/answer` — requires `user`, `workspace`, `question`, `answer`, `expectedVersion`
- `/workspaces/questions/steps/ask` — requires `user`, `workspace`, `procedure`, `step`, `text`
- `/workspaces/questions/steps/revise` — requires `user`, `workspace`, `question`, `answer`, `expectedVersion`
- `/workspaces/reviews` — requires `user`, `workspace`
- `/workspaces/reviews/cancel` — requires `user`, `workspace`, `review`, `procedure`, `expectedVersion`
- `/workspaces/reviews/confirm` — requires `user`, `workspace`, `review`, `procedure`, `expectedVersion`
- `/workspaces/reviews/pending` — requires `user`, `workspace`
- `/workspaces/reviews/require-changes` — requires `user`, `workspace`, `review`, `procedure`, `expectedVersion`
- `/workspaces/reviews/resolve` — requires `user`, `workspace`, `review`, `procedure`, `expectedVersion`
