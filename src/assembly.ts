import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { ContextTrackingConcept } from "./concepts/ContextTracking.ts";
import { db, mongoClient } from "./db.ts";
import { ProcedureMaintainingConcept } from "./concepts/ProcedureMaintaining.ts";
import { RoleBasedAccessingConcept } from "./concepts/RoleBasedAccessing.ts";
import { ReviewingConcept } from "./concepts/Reviewing.ts";
import { composition } from "./compositions/Relay.ts";

export function assembleApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      ContextTracking: new ContextTrackingConcept(db, mongoClient),
      ProcedureMaintaining: new ProcedureMaintainingConcept(db, mongoClient),
      Reviewing: new ReviewingConcept(db, mongoClient),
      RoleBasedAccessing: new RoleBasedAccessingConcept(db, mongoClient),
    },
    composition,
  });
}
