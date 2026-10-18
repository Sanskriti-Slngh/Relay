# Relay MVP Application Types

The instances below preserve Relay's cross-concept identity relationships.
RoleBasedAccessing receives a User identity supplied by the application; the
application must establish that identity through a trustworthy authentication
boundary before invoking authorization. The Command value is an opaque
application command passed through authorization unchanged.

```types
concrete ClubWorkspace
  A club workspace that owns procedures and scopes shared context.

concrete User
  A stable user identity established by the application.

concrete Permission
  An application permission identity. Relay's permission values are ASK_QUESTION, EDIT_PROCEDURE, EDIT_CONTEXT, ANSWER_QUESTION, and COMPLETE_REVIEW.

concrete Command
  An opaque application command passed through authorization unchanged.
```

The P3 host provisions the Officer Role with `ASK_QUESTION`,
`ANSWER_QUESTION`, `EDIT_PROCEDURE`, `EDIT_CONTEXT`, and `COMPLETE_REVIEW`.
The Member Role has only `ASK_QUESTION`, which also authorizes workspace-scoped
Procedure, ContextNote, and Question reads. Workspace creators receive Officer;
accepted invitations receive Member. Relay exposes no public endpoint for
choosing a Role, granting Permissions, or assigning Users.

```instances
instantiate ProcedureMaintaining with
  Space is ClubWorkspace

instantiate ContextTracking with
  Scope is ClubWorkspace
  Subject is ProcedureMaintaining.Procedure
  Anchor is ProcedureMaintaining.Step

instantiate Questioning as StepQuestioning with
  Subject is ProcedureMaintaining.Step
  Answerer is User

instantiate Questioning as ContextQuestioning with
  Subject is ContextTracking.ContextNote
  Answerer is User

instantiate Reviewing with
  Item is ProcedureMaintaining.Procedure
  Cause is ContextTracking.Change

instantiate RoleBasedAccessing with
  User is User
  Resource is ClubWorkspace
  Permission is Permission
  Command is Command
```
