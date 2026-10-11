# ProcedureMaintaining Incremental Application Types

This temporary application contract selects only the implemented
ProcedureMaintaining instance for incremental source diagnostics. The complete
Relay type inventory remains in `types.md`.

```types
concrete ClubWorkspace
  A club workspace that owns Procedures.
```

```instances
instantiate ProcedureMaintaining with
  Space is ClubWorkspace
```
