# Relay Two-Concept Incremental Application Types

This temporary application contract selects only the implemented
ProcedureMaintaining and ContextTracking instances for incremental source
diagnostics. The complete Relay instance inventory remains in `types.md`.

```types
concrete ClubWorkspace
  A club workspace that owns Procedures and scopes shared context.
```

```instances
instantiate ProcedureMaintaining with
  Space is ClubWorkspace

instantiate ContextTracking with
  Scope is ClubWorkspace
  Subject is ProcedureMaintaining.Procedure
  Anchor is ProcedureMaintaining.Step
```
