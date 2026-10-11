import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { ContextTrackingConcept } from "./concepts/ContextTracking.ts";
import { db, mongoClient } from "./db.ts";
import { ProcedureMaintainingConcept } from "./concepts/ProcedureMaintaining.ts";

export function assembleApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      ContextTracking: new ContextTrackingConcept(db, mongoClient),
      ProcedureMaintaining: new ProcedureMaintainingConcept(db, mongoClient),
    },
    composition: {},
  });
}
