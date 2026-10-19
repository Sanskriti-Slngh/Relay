import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/ProcedureMaintaining.md" with { type: "text" };
import {
  InvalidPosition,
  ProcedureMaintainingConcept,
  ProcedureNotActive,
  ProcedureNotFound,
  StepNotActive,
  StepNotFound,
  VersionConflict,
} from "./ProcedureMaintaining.ts";

export const procedureMaintaining = registerConcept({
  class: ProcedureMaintainingConcept,
  spec,
  refusals: {
    PROCEDURE_NOT_FOUND: ProcedureNotFound,
    PROCEDURE_NOT_ACTIVE: ProcedureNotActive,
    STEP_NOT_FOUND: StepNotFound,
    STEP_NOT_ACTIVE: StepNotActive,
    INVALID_POSITION: InvalidPosition,
    VERSION_CONFLICT: VersionConflict,
  },
});
