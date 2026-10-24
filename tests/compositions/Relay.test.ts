import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { assemble } from "@mit-sdg/sync-engine/assembly";
import { MongoClient } from "mongodb";
import { db } from "../../src/db.ts";
import { ContextTrackingConcept } from "../../src/concepts/ContextTracking.ts";
import { ProcedureMaintainingConcept } from "../../src/concepts/ProcedureMaintaining.ts";
import { QuestioningConcept } from "../../src/concepts/Questioning.ts";
import { ReviewingConcept } from "../../src/concepts/Reviewing.ts";
import { RoleBasedAccessingConcept } from "../../src/concepts/RoleBasedAccessing.ts";
import { applicationConceptSet } from "../../src/concepts.ts";
import { composition } from "../../src/compositions/Relay.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const testDatabaseName = `relay_composition_tests_${crypto.randomUUID().replaceAll("-", "")}`;
const testDb = testClient.db(testDatabaseName);
const applicationDatabaseName = db.databaseName;

if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The Relay composition test database must be isolated from application data.");
}

type ActionEvent = {
  type: "action-settled";
  concept: string;
  action: string;
  reaction?: string;
  result: "success" | "refusal" | "fault";
};

const actionEvents: ActionEvent[] = [];
let application: ReturnType<typeof assemble>;

function requireSuccess<T extends { error?: never }>(result: T | { error: string }): T {
  if ("error" in result) {
    throw new Error(`Assembled concept action refused: ${result.error}`);
  }
  return result;
}

async function createProcedure(title: string): Promise<string> {
  const result = requireSuccess(
    await application.concepts.ProcedureMaintaining.create({
      space: "relay-composition-test-workspace",
      title,
    }),
  );
  return result.procedure;
}

async function addStep(procedure: string, text: string): Promise<string> {
  const result = requireSuccess(
    await application.concepts.ProcedureMaintaining.addStep({ procedure, text }),
  );
  return result.step;
}

async function changesFor(
  context: string,
): Promise<{ change: string; before: string; after: string }[]> {
  return application.concepts.ContextTracking._changes({ context });
}

async function reviewsFor(procedure: string): Promise<{ review: string; status: string }[]> {
  return application.concepts.Reviewing._forItem({ item: procedure });
}

describe("Relay internal composition reactions", () => {
  beforeAll(async () => {
    await testClient.connect();
    await testDb.command({ ping: 1 });

    application = assemble({
      conceptSet: applicationConceptSet,
      instances: {
        ContextTracking: new ContextTrackingConcept(testDb, testClient),
        ProcedureMaintaining: new ProcedureMaintainingConcept(testDb, testClient),
        StepQuestioning: new QuestioningConcept(testDb, testClient, "stepQuestioning"),
        ContextQuestioning: new QuestioningConcept(testDb, testClient, "contextQuestioning"),
        Reviewing: new ReviewingConcept(testDb, testClient),
        RoleBasedAccessing: new RoleBasedAccessingConcept(testDb, testClient),
      },
      composition,
      observers: [
        (event) => {
          if (event.type === "action-settled") actionEvents.push(event);
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (application) await application.whenIdle();
      await testClient.db(testDatabaseName).dropDatabase();
      const remainingTestDatabases = await testClient.db("admin").command({
        listDatabases: 1,
        nameOnly: true,
        filter: { name: testDatabaseName },
      });
      expect(remainingTestDatabases.databases).toEqual([]);
    } finally {
      await testClient.close();
    }
  });

  test("uses a unique database separate from configured application data", () => {
    expect(testDatabaseName).not.toBe(applicationDatabaseName);
    expect(testDatabaseName).toMatch(/^relay_composition_tests_[a-f0-9]+$/);
  });

  test("fans a Change out once per active Procedure, skips retired Procedures, and accumulates Causes", async () => {
    const firstProcedure = await createProcedure("First renewal procedure");
    const firstStep = await addStep(firstProcedure, "Review annual renewal");
    const secondStep = await addStep(firstProcedure, "Approve semester renewal");
    const secondProcedure = await createProcedure("Second renewal procedure");
    const secondProcedureStep = await addStep(secondProcedure, "Confirm renewal");
    const retiredProcedure = await createProcedure("Retired renewal procedure");
    const retiredStep = await addStep(retiredProcedure, "Retired step");
    requireSuccess(await application.concepts.ProcedureMaintaining.retire({
      procedure: retiredProcedure,
    }));

    const { context } = requireSuccess(
      await application.concepts.ContextTracking.record({
        scope: "relay-composition-test-workspace",
        text: "Annual renewal",
      }),
    );
    await application.concepts.ContextTracking.attachAt({
      context,
      subject: firstProcedure,
      anchor: firstStep,
    }).then(requireSuccess);
    await application.concepts.ContextTracking.attachAt({
      context,
      subject: firstProcedure,
      anchor: secondStep,
    }).then(requireSuccess);
    await application.concepts.ContextTracking.attachAt({
      context,
      subject: secondProcedure,
      anchor: secondProcedureStep,
    }).then(requireSuccess);
    await application.concepts.ContextTracking.attachAt({
      context,
      subject: retiredProcedure,
      anchor: retiredStep,
    }).then(requireSuccess);

    const firstChange = requireSuccess(
      await application.concepts.ContextTracking.change({
        context,
        text: "Semester renewal",
      }),
    );
    await application.whenIdle();

    expect(await changesFor(context)).toEqual([
      expect.objectContaining({
        change: firstChange.change,
        before: "Annual renewal",
        after: "Semester renewal",
        occurredAt: expect.any(String),
      }),
    ]);

    const firstReviews = await reviewsFor(firstProcedure);
    const secondReviews = await reviewsFor(secondProcedure);
    expect(firstReviews).toHaveLength(1);
    expect(secondReviews).toHaveLength(1);
    expect(new Set(firstReviews.map(({ review }) => review)).size).toBe(1);
    expect(new Set(secondReviews.map(({ review }) => review)).size).toBe(1);
    expect(await application.concepts.Reviewing._causes({ review: firstReviews[0].review }))
      .toEqual([{ cause: firstChange.change }]);
    expect(await application.concepts.Reviewing._causes({ review: secondReviews[0].review }))
      .toEqual([{ cause: firstChange.change }]);
    expect(await reviewsFor(retiredProcedure)).toEqual([]);

    const correctionProcedure = await createProcedure("Correction-only procedure");
    const correctionStep = await addStep(correctionProcedure, "Check corrected wording");
    const { context: correctionContext } = requireSuccess(
      await application.concepts.ContextTracking.record({
        scope: "relay-composition-test-workspace",
        text: "Annual renewel",
      }),
    );
    await application.concepts.ContextTracking.attachAt({
      context: correctionContext,
      subject: correctionProcedure,
      anchor: correctionStep,
    }).then(requireSuccess);
    requireSuccess(
      await application.concepts.ContextTracking.correct({
        context: correctionContext,
        text: "Annual renewal",
      }),
    );
    await application.whenIdle();

    expect(await application.concepts.ContextTracking._get({ context: correctionContext }))
      .toEqual([{ scope: "relay-composition-test-workspace", text: "Annual renewal" }]);
    expect(await changesFor(correctionContext)).toEqual([]);
    expect(await reviewsFor(correctionProcedure)).toEqual([]);

    const priorFirstReviewId = firstReviews[0].review;
    const priorSecondReviewId = secondReviews[0].review;
    const secondChange = requireSuccess(
      await application.concepts.ContextTracking.change({
        context,
        text: "Semester renewal with updated checklist",
      }),
    );
    await application.whenIdle();

    const history = await changesFor(context);
    expect(history).toHaveLength(2);
    expect(history).toContainEqual(expect.objectContaining({
      change: firstChange.change,
      before: "Annual renewal",
      after: "Semester renewal",
      occurredAt: expect.any(String),
    }));
    expect(history).toContainEqual(expect.objectContaining({
      change: secondChange.change,
      before: "Semester renewal",
      after: "Semester renewal with updated checklist",
      occurredAt: expect.any(String),
    }));
    expect(await reviewsFor(firstProcedure)).toEqual([
      { review: priorFirstReviewId, status: "PENDING" },
    ]);
    expect(await reviewsFor(secondProcedure)).toEqual([
      { review: priorSecondReviewId, status: "PENDING" },
    ]);
    for (const review of [priorFirstReviewId, priorSecondReviewId]) {
      const causes: { cause: string }[] = await application.concepts.Reviewing._causes({
        review,
      });
      expect(causes).toHaveLength(2);
      expect(new Set(causes.map(({ cause }) => cause))).toEqual(
        new Set([firstChange.change, secondChange.change]),
      );
    }
    expect(await reviewsFor(retiredProcedure)).toEqual([]);
  });

  test("concurrent Changes retain one Review and every Cause for one Procedure", async () => {
    const procedure = await createProcedure("Concurrent renewal procedure");
    const firstStep = await addStep(procedure, "Read current policy");
    const secondStep = await addStep(procedure, "Approve revised policy");
    const contexts = await Promise.all(
      ["Concurrent note A", "Concurrent note B", "Concurrent note C", "Concurrent note D"].map(
        async (text) =>
          requireSuccess(
            await application.concepts.ContextTracking.record({
              scope: "relay-composition-test-workspace",
              text,
            }),
          ),
      ),
    );

    await Promise.all(
      contexts.map(({ context }, index) =>
        application.concepts.ContextTracking.attachAt({
          context,
          subject: procedure,
          anchor: index % 2 === 0 ? firstStep : secondStep,
        }).then(requireSuccess),
      ),
    );

    const priorEventCount = actionEvents.length;
    const changes = await Promise.all(
      contexts.map(({ context }, index) =>
        application.concepts.ContextTracking.change({
          context,
          text: `Concurrent revised note ${index}`,
        }).then(requireSuccess),
      ),
    );
    await application.whenIdle();

    const procedureReviews = await reviewsFor(procedure);
    expect(procedureReviews).toHaveLength(1);
    const [review] = procedureReviews;
    expect(review.status).toBe("PENDING");

    const concurrentEvents = actionEvents.slice(priorEventCount);
    const requestRefusals = concurrentEvents.filter(
      (event) =>
        event.type === "action-settled" &&
        event.concept === "Reviewing" &&
        event.action === "request" &&
        event.result === "refusal",
    );
    const recoveryAdds = concurrentEvents.filter(
      (event) =>
        event.type === "action-settled" &&
        event.concept === "Reviewing" &&
        event.action === "addCause" &&
        event.reaction === "Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal" &&
        event.result === "success",
    );
    expect(recoveryAdds).toHaveLength(requestRefusals.length);

    const causes: { cause: string }[] = await application.concepts.Reviewing._causes({
      review: review.review,
    });
    const expectedCauses = changes.map(({ change }) => change);
    expect(new Set(causes.map(({ cause }) => cause))).toEqual(new Set(expectedCauses));
    expect(causes).toHaveLength(expectedCauses.length);

  });

  test("recovers a concurrent request refusal by attaching its Cause to the existing Review", async () => {
    const item = "concurrent-request-recovery-procedure";
    const causes = ["recovery-cause-a", "recovery-cause-b"];
    const priorEventCount = actionEvents.length;
    const outcomes = await Promise.all(
      causes.map((cause) => application.concepts.Reviewing.request({ item, cause })),
    );
    await application.whenIdle();

    const successes = outcomes.filter(
      (outcome): outcome is { review: string } => !("error" in outcome),
    );
    const refusals = outcomes.filter(
      (outcome): outcome is { error: string } => "error" in outcome,
    );
    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(1);
    expect(refusals[0].error).toBe("REQUEST_ALREADY_UNFINISHED");

    const events = actionEvents.slice(priorEventCount);
    const requestRefusals = events.filter(
      (event) =>
        event.type === "action-settled" &&
        event.concept === "Reviewing" &&
        event.action === "request" &&
        event.result === "refusal",
    );
    const recoveryAdds = events.filter(
      (event) =>
        event.type === "action-settled" &&
        event.concept === "Reviewing" &&
        event.action === "addCause" &&
        event.reaction === "Relay.ContextChanges.AddCauseAfterConcurrentRequestRefusal" &&
        event.result === "success",
    );
    expect(requestRefusals).toHaveLength(1);
    expect(recoveryAdds).toHaveLength(1);

    const itemReviews = await reviewsFor(item);
    expect(itemReviews).toHaveLength(1);
    const [review] = itemReviews;
    expect(review.status).toBe("PENDING");
    const persistedCauses: { cause: string }[] = await application.concepts.Reviewing._causes({
      review: review.review,
    });
    expect(new Set(persistedCauses.map(({ cause }) => cause))).toEqual(new Set(causes));
    expect(persistedCauses).toHaveLength(causes.length);
  });
});
