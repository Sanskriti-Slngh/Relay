import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { procedureMaintaining } from "./concepts/ProcedureMaintaining.registry.ts";

export const applicationConceptSet = conceptSet({
  ProcedureMaintaining: procedureMaintaining,
});
export const { concepts } = applicationConceptSet;
