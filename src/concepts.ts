import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { contextTracking } from "./concepts/ContextTracking.registry.ts";
import { procedureMaintaining } from "./concepts/ProcedureMaintaining.registry.ts";

export const applicationConceptSet = conceptSet({
  ProcedureMaintaining: procedureMaintaining,
  ContextTracking: contextTracking,
});
export const { concepts } = applicationConceptSet;
