import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  InvalidPosition,
  ProcedureMaintainingConcept,
  ProcedureNotActive,
  ProcedureNotFound,
  StepNotActive,
  StepNotFound,
} from "../../src/concepts/ProcedureMaintaining.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = testClient.db().databaseName;
const testDatabaseName = `relay_procedure_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The ProcedureMaintaining test database must be isolated from application data.");
}
const testDb = testClient.db(testDatabaseName);
const concept = new ProcedureMaintainingConcept(testDb, testClient);

async function createProcedure(title: string) {
  return concept.create({ space: "procedure-maintaining-test-space", title });
}

async function addSteps(procedure: string, texts: string[]) {
  const created = [];
  for (const text of texts) {
    created.push(await concept.addStep({ procedure, text }));
  }
  return created;
}

describe("ProcedureMaintaining concept", () => {
  beforeAll(async () => {
    await testClient.connect();
    await testDb.command({ ping: 1 });
  });

  afterAll(async () => {
    try {
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

  test("uses a unique database separate from the configured application database", () => {
    expect(testDatabaseName).not.toBe(applicationDatabaseName);
    expect(testDatabaseName).toMatch(/^relay_procedure_tests_[a-f0-9]+$/);
  });

  test("creates a Procedure and retrieves it by identity and Space", async () => {
    const { procedure } = await createProcedure("Create and retrieve");

    expect(await concept._get({ procedure })).toEqual([
      { space: "procedure-maintaining-test-space", title: "Create and retrieve", status: "ACTIVE" },
    ]);
    expect(await concept._procedures({ space: "procedure-maintaining-test-space" })).toContainEqual({
      procedure,
      title: "Create and retrieve",
      status: "ACTIVE",
    });
  });

  test("adds several Steps in exact contiguous order", async () => {
    const { procedure } = await createProcedure("Add ordered Steps");
    const created = await addSteps(procedure, ["Prepare", "Perform", "Verify", "Close"]);

    expect(await concept._steps({ procedure })).toEqual([
      { step: created[0].step, text: "Prepare", position: 1 },
      { step: created[1].step, text: "Perform", position: 2 },
      { step: created[2].step, text: "Verify", position: 3 },
      { step: created[3].step, text: "Close", position: 4 },
    ]);
  });

  test("moves Steps forward and backward without changing their identities", async () => {
    const { procedure } = await createProcedure("Move Steps");
    const created = await addSteps(procedure, ["A", "B", "C", "D"]);
    const identities = created.map(({ step }) => step);

    await concept.moveStep({ step: identities[0], position: 3 });
    expect(await concept._steps({ procedure })).toEqual([
      { step: identities[1], text: "B", position: 1 },
      { step: identities[2], text: "C", position: 2 },
      { step: identities[0], text: "A", position: 3 },
      { step: identities[3], text: "D", position: 4 },
    ]);

    await concept.moveStep({ step: identities[3], position: 2 });
    expect(await concept._steps({ procedure })).toEqual([
      { step: identities[1], text: "B", position: 1 },
      { step: identities[3], text: "D", position: 2 },
      { step: identities[2], text: "C", position: 3 },
      { step: identities[0], text: "A", position: 4 },
    ]);
    expect(new Set((await concept._steps({ procedure })).map(({ step }) => step))).toEqual(
      new Set(identities),
    );
  });

  test("removes a Step from the order while preserving its identity and text", async () => {
    const { procedure } = await createProcedure("Remove a Step");
    const created = await addSteps(procedure, ["First", "Keep this", "Last"]);
    const removedStep = created[1].step;

    await concept.removeStep({ step: removedStep });

    expect(await concept._steps({ procedure })).toEqual([
      { step: created[0].step, text: "First", position: 1 },
      { step: created[2].step, text: "Last", position: 2 },
    ]);
    expect(await concept._getStep({ step: removedStep })).toEqual([
      { procedure, text: "Keep this", status: "REMOVED" },
    ]);
  });

  test("edits active Step text without changing its identity or position", async () => {
    const { procedure } = await createProcedure("Edit a Step");
    const [{ step }, second] = await addSteps(procedure, ["Old text", "Second"]);

    expect(await concept.editStep({ step, text: "Updated text" })).toEqual({});
    expect(await concept._steps({ procedure })).toEqual([
      { step, text: "Updated text", position: 1 },
      { step: second.step, text: "Second", position: 2 },
    ]);
  });

  test("renames and retires a Procedure", async () => {
    const { procedure } = await createProcedure("Original title");

    expect(await concept.rename({ procedure, title: "Renamed title" })).toEqual({});
    expect(await concept._get({ procedure })).toEqual([
      { space: "procedure-maintaining-test-space", title: "Renamed title", status: "ACTIVE" },
    ]);

    expect(await concept.retire({ procedure })).toEqual({});
    expect(await concept._get({ procedure })).toEqual([
      { space: "procedure-maintaining-test-space", title: "Renamed title", status: "RETIRED" },
    ]);
  });

  test("refuses unknown Procedures and Steps with their specified error classes", async () => {
    await expect(concept.addStep({ procedure: "missing-procedure", text: "No" })).rejects
      .toBeInstanceOf(ProcedureNotFound);
    await expect(concept.editStep({ step: "missing-step", text: "No" })).rejects
      .toBeInstanceOf(StepNotFound);
    await expect(concept.moveStep({ step: "missing-step", position: 1 })).rejects
      .toBeInstanceOf(StepNotFound);
    await expect(concept.removeStep({ step: "missing-step" })).rejects
      .toBeInstanceOf(StepNotFound);
    await expect(concept.rename({ procedure: "missing-procedure", title: "No" })).rejects
      .toBeInstanceOf(ProcedureNotFound);
    await expect(concept.retire({ procedure: "missing-procedure" })).rejects
      .toBeInstanceOf(ProcedureNotFound);
  });

  test("refuses operations on retired Procedures and removed Steps", async () => {
    const retired = await createProcedure("Retired");
    const [{ step: retiredProcedureStep }] = await addSteps(retired.procedure, ["Existing"]);
    await concept.retire({ procedure: retired.procedure });

    await expect(concept.addStep({ procedure: retired.procedure, text: "No" })).rejects
      .toBeInstanceOf(ProcedureNotActive);
    await expect(concept.rename({ procedure: retired.procedure, title: "No" })).rejects
      .toBeInstanceOf(ProcedureNotActive);
    await expect(concept.retire({ procedure: retired.procedure })).rejects
      .toBeInstanceOf(ProcedureNotActive);
    await expect(concept.editStep({ step: retiredProcedureStep, text: "No" })).rejects
      .toBeInstanceOf(ProcedureNotActive);
    await expect(concept.moveStep({ step: retiredProcedureStep, position: 1 })).rejects
      .toBeInstanceOf(ProcedureNotActive);
    await expect(concept.removeStep({ step: retiredProcedureStep })).rejects
      .toBeInstanceOf(ProcedureNotActive);

    const active = await createProcedure("Removed Step");
    const [{ step: removedStep }] = await addSteps(active.procedure, ["Preserved"]);
    await concept.removeStep({ step: removedStep });
    await expect(concept.editStep({ step: removedStep, text: "No" })).rejects
      .toBeInstanceOf(StepNotActive);
    await expect(concept.moveStep({ step: removedStep, position: 1 })).rejects
      .toBeInstanceOf(StepNotActive);
    await expect(concept.removeStep({ step: removedStep })).rejects
      .toBeInstanceOf(StepNotActive);
  });

  test("refuses invalid positions without changing Step state or order", async () => {
    const { procedure } = await createProcedure("Invalid positions");
    const [{ step: first }, { step: second }] = await addSteps(procedure, ["First", "Second"]);
    const before = await concept._steps({ procedure });

    for (const position of [0, 3, 1.5, Number.NaN]) {
      await expect(concept.moveStep({ step: first, position })).rejects
        .toBeInstanceOf(InvalidPosition);
      expect(await concept._steps({ procedure })).toEqual(before);
      expect(await concept._getStep({ step: first })).toEqual([
        { procedure, text: "First", status: "ACTIVE" },
      ]);
      expect(await concept._getStep({ step: second })).toEqual([
        { procedure, text: "Second", status: "ACTIVE" },
      ]);
    }
  });

  test("concurrent additions leave unique identities and contiguous positions", async () => {
    const { procedure } = await createProcedure("Concurrent additions");
    const texts = Array.from({ length: 8 }, (_, index) => `Concurrent Step ${index}`);
    const created = await Promise.all(
      texts.map((text) => concept.addStep({ procedure, text })),
    );
    const found = await concept._steps({ procedure });

    expect(found).toHaveLength(texts.length);
    expect(found.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(found.map(({ step }) => step)).size).toBe(texts.length);
    expect(new Set(found.map(({ text }) => text))).toEqual(new Set(texts));
    expect(new Set(created.map(({ step }) => step))).toEqual(new Set(found.map(({ step }) => step)));
  });

  test("reordering preserves each Step identity and associated text", async () => {
    const { procedure } = await createProcedure("Stable Step identities");
    const created = await addSteps(procedure, ["Alpha", "Bravo", "Charlie"]);
    const identityToText = new Map(created.map(({ step }, index) => [step, ["Alpha", "Bravo", "Charlie"][index]]));

    await concept.moveStep({ step: created[2].step, position: 1 });
    await concept.moveStep({ step: created[0].step, position: 2 });

    const found = await concept._steps({ procedure });
    expect(found.map(({ step }) => step)).toEqual([
      created[2].step,
      created[0].step,
      created[1].step,
    ]);
    expect(found.every(({ step, text }) => identityToText.get(step) === text)).toBe(true);
  });
});
