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

The broader type inventory preserves the P1 question-related permission names,
but the P2 host provisions only `EDIT_PROCEDURE`, `EDIT_CONTEXT`, and
`COMPLETE_REVIEW`. No public P2 endpoint creates Roles, grants Permissions, or
assigns Users.

```instances
instantiate ProcedureMaintaining with
  Space is ClubWorkspace

instantiate ContextTracking with
  Scope is ClubWorkspace
  Subject is ProcedureMaintaining.Procedure
  Anchor is ProcedureMaintaining.Step

instantiate Reviewing with
  Item is ProcedureMaintaining.Procedure
  Cause is ContextTracking.Change

instantiate RoleBasedAccessing with
  User is User
  Resource is ClubWorkspace
  Permission is Permission
  Command is Command
```
