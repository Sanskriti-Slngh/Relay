# ProcedureMaintaining

## Purpose

Preserve a reusable ordered procedure so recurring work does not have to be
reconstructed each time.

## Principle

A recurring process is recorded as an ordered set of steps. Later, the same
procedure can be reused and revised instead of reconstructed from scratch,
while each step keeps a stable identity as the ordering and contents change.

## Types

```types
external Space
  The club workspace that owns a Procedure.

ProcedureStatus is ACTIVE or RETIRED
  The lifecycle states a Procedure may occupy.

StepStatus is ACTIVE or REMOVED
  The lifecycle states a Step may occupy.
```

## State

```state
a set of Procedures with
  a space Space
  a title String
  a status ProcedureStatus
  a version Number

a set of Steps with
  a procedure Procedure
  a text String
  an optional position Number
  a status StepStatus
  a version Number

Rule: every ACTIVE Step has a positive integer position

Rule: every REMOVED Step has no position

Rule: for every Procedure with n ACTIVE Steps, their positions are exactly 1 through n
```

## Actions

```actions
create (space: Space, title: String) : returns (procedure: Procedure)
  where true
  then
    create a new Procedure with given space and title
    set procedure status to ACTIVE
    set procedure version to 1
    returns procedure

addStep (procedure: Procedure, text: String, expectedVersion?: Number) : returns (step: Step)
  where procedure does not exist
  then
    refuses PROCEDURE_NOT_FOUND "There is no such Procedure."
  where procedure exists and procedure status is RETIRED
  then
    refuses PROCEDURE_NOT_ACTIVE "The Procedure is retired."
  where procedure exists and procedure status is ACTIVE and procedure version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Procedure changed after it was loaded."
  where procedure exists and procedure status is ACTIVE
  then
    create a new Step for procedure with given text
    set step status to ACTIVE
    set step position to one more than the number of ACTIVE Steps
      belonging to procedure
    set step version to 1
    increment procedure version
    returns step

editStep (step: Step, text: String, expectedVersion?: Number) : returns ()
  where step does not exist
  then
    refuses STEP_NOT_FOUND "There is no such Step."
  where step exists and step status is REMOVED
  then
    refuses STEP_NOT_ACTIVE "The Step has been removed."
  where step exists and step status is ACTIVE and step version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Step changed after it was loaded."
  where step exists and step status is ACTIVE and step's procedure does not exist
  then
    refuses PROCEDURE_NOT_FOUND "There is no such Procedure."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is RETIRED
  then
    refuses PROCEDURE_NOT_ACTIVE "The Step's Procedure is retired."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is ACTIVE
  then
    replace step text with text
    increment step version
    returns

moveStep (step: Step, position: Number, expectedVersion?: Number) : returns ()
  where step does not exist
  then
    refuses STEP_NOT_FOUND "There is no such Step."
  where step exists and step status is REMOVED
  then
    refuses STEP_NOT_ACTIVE "The Step has been removed."
  where step exists and step status is ACTIVE and step's procedure version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Procedure changed after it was loaded."
  where step exists and step status is ACTIVE and step's procedure does not exist
  then
    refuses PROCEDURE_NOT_FOUND "There is no such Procedure."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is RETIRED
  then
    refuses PROCEDURE_NOT_ACTIVE "The Step's Procedure is retired."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is ACTIVE and (position is not an integer or position is less than 1 or position is greater than the number of ACTIVE Steps belonging to step's procedure)
  then
    refuses INVALID_POSITION "Position must be an integer within the active Step order."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is ACTIVE and position is an integer and 1 <= position <= the number of ACTIVE Steps belonging to step's procedure
  then
    move step to given position
    shift the other ACTIVE Step positions as needed so the positions
      remain exactly 1 through n
    increment procedure version
    returns

removeStep (step: Step, expectedVersion?: Number) : returns ()
  where step does not exist
  then
    refuses STEP_NOT_FOUND "There is no such Step."
  where step exists and step status is REMOVED
  then
    refuses STEP_NOT_ACTIVE "The Step has been removed."
  where step exists and step status is ACTIVE and step's procedure version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Procedure changed after it was loaded."
  where step exists and step status is ACTIVE and step's procedure does not exist
  then
    refuses PROCEDURE_NOT_FOUND "There is no such Procedure."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is RETIRED
  then
    refuses PROCEDURE_NOT_ACTIVE "The Step's Procedure is retired."
  where step exists and step status is ACTIVE and step's procedure exists and step's procedure status is ACTIVE
  then
    set step status to REMOVED
    remove step position
    shift later ACTIVE Step positions down by one
    increment procedure version
    returns

rename (procedure: Procedure, title: String, expectedVersion?: Number) : returns ()
  where procedure does not exist
  then
    refuses PROCEDURE_NOT_FOUND "There is no such Procedure."
  where procedure exists and procedure status is RETIRED
  then
    refuses PROCEDURE_NOT_ACTIVE "The Procedure is retired."
  where procedure exists and procedure status is ACTIVE and procedure version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Procedure changed after it was loaded."
  where procedure exists and procedure status is ACTIVE
  then
    replace procedure title with title
    increment procedure version
    returns

retire (procedure: Procedure, expectedVersion?: Number) : returns ()
  where procedure does not exist
  then
    refuses PROCEDURE_NOT_FOUND "There is no such Procedure."
  where procedure exists and procedure status is RETIRED
  then
    refuses PROCEDURE_NOT_ACTIVE "The Procedure is already retired."
  where procedure exists and procedure status is ACTIVE and procedure version is not expectedVersion
  then
    refuses VERSION_CONFLICT "The Procedure changed after it was loaded."
  where procedure exists and procedure status is ACTIVE
  then
    set procedure status to RETIRED
    increment procedure version
    returns
```

## Queries

```queries
_procedures (space: Space) : many (procedure: Procedure, title: String, status: ProcedureStatus)
  answers all Procedures owned by the Space, including retired Procedures
  answers no rows when the Space has no Procedures
  orders rows by title, then by stable Procedure identity
_get (procedure: Procedure) : optional (space: Space, title: String, status: ProcedureStatus)
  answers no row for an unknown Procedure
_steps (procedure: Procedure) : many (step: Step, text: String, position: Number)
  answers the Procedure's ACTIVE Steps
  answers no rows for an unknown Procedure or a Procedure with no ACTIVE Steps
  orders rows by position from 1 through the number of ACTIVE Steps
_getStep (step: Step) : optional (procedure: Procedure, text: String, status: StepStatus)
  answers no row for an unknown Step
_getVersion (procedure: Procedure) : optional (version: Number)
  answers the current version of a known Procedure
_getStepVersion (step: Step) : optional (version: Number)
  answers the current text version of a known Step
```
