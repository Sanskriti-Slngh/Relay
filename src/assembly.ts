import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db, MongoClient } from "mongodb";
import { applicationConceptSet } from "./concepts.ts";
import { ContextTrackingConcept } from "./concepts/ContextTracking.ts";
import { db, mongoClient } from "./db.ts";
import { ProcedureMaintainingConcept } from "./concepts/ProcedureMaintaining.ts";
import { QuestioningConcept } from "./concepts/Questioning.ts";
import { RoleBasedAccessingConcept } from "./concepts/RoleBasedAccessing.ts";
import { ReviewingConcept } from "./concepts/Reviewing.ts";
import { composition } from "./compositions/Relay.ts";

export function createApplication(database: Db, client: MongoClient) {
  const roleAccess = new RoleBasedAccessingConcept(database, client);
  const application = assemble({
    conceptSet: applicationConceptSet,
    instances: {
      ContextTracking: new ContextTrackingConcept(database, client),
      ProcedureMaintaining: new ProcedureMaintainingConcept(database, client),
      StepQuestioning: new QuestioningConcept(database, client, "stepQuestioning"),
      ContextQuestioning: new QuestioningConcept(database, client, "contextQuestioning"),
      Reviewing: new ReviewingConcept(database, client),
      RoleBasedAccessing: roleAccess,
    },
    composition,
  });
  return { application, roleAccess };
}

export function assembleApplication() {
  return createApplication(db, mongoClient).application;
}
