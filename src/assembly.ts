import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { db, mongoClient } from "./db.ts";
import { ProcedureMaintainingConcept } from "./concepts/ProcedureMaintaining.ts";

export function assembleApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      ProcedureMaintaining: new ProcedureMaintainingConcept(db, mongoClient),
    },
    composition: {},
  });
}
