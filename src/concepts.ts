import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { contextTracking } from "./concepts/ContextTracking.registry.ts";
import { procedureMaintaining } from "./concepts/ProcedureMaintaining.registry.ts";
import { reviewing } from "./concepts/Reviewing.registry.ts";

export const applicationConceptSet = conceptSet({
  ProcedureMaintaining: procedureMaintaining,
  ContextTracking: contextTracking,
  Reviewing: reviewing,
});
export const { concepts } = applicationConceptSet;
