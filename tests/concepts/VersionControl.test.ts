import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { ContextTrackingConcept, VersionConflict as ContextVersionConflict } from "../../src/concepts/ContextTracking.ts";
import { ProcedureMaintainingConcept, VersionConflict as ProcedureVersionConflict } from "../../src/concepts/ProcedureMaintaining.ts";
import { QuestioningConcept, VersionConflict as QuestionVersionConflict } from "../../src/concepts/Questioning.ts";
import { ReviewingConcept, VersionConflict as ReviewVersionConflict } from "../../src/concepts/Reviewing.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) throw new Error("MONGODB_URL is required.");
const client = new MongoClient(configuredUrl);
const databaseName = `relay_version_control_${crypto.randomUUID().replaceAll("-", "")}`;
const database = client.db(databaseName);
const procedures = new ProcedureMaintainingConcept(database, client);
const contexts = new ContextTrackingConcept(database, client);
const questions = new QuestioningConcept(database, client, "versionControlQuestions");
const reviews = new ReviewingConcept(database, client);

describe("collaborative version control", () => {
  beforeAll(async () => {
    await client.connect();
    await database.command({ ping: 1 });
  });

  afterAll(async () => {
    try { await database.dropDatabase(); }
    finally { await client.close(); }
  });

  test("protects Playbook structure and Step text independently", async () => {
    const { procedure } = await procedures.create({ space: "club", title: "Concurrent edits" });
    const { step } = await procedures.addStep({ procedure, text: "Original", expectedVersion: 1 });
    await expect(procedures.addStep({ procedure, text: "Stale addition", expectedVersion: 1 })).rejects.toBeInstanceOf(ProcedureVersionConflict);
    await procedures.editStep({ step, text: "Officer A", expectedVersion: 1 });
    await expect(procedures.editStep({ step, text: "Officer B stale draft", expectedVersion: 1 })).rejects.toBeInstanceOf(ProcedureVersionConflict);
    expect(await procedures._steps({ procedure })).toEqual([{ step, text: "Officer A", position: 1 }]);
  });

  test("a stale meaningful Context change creates neither an overwrite nor extra history", async () => {
    const { context } = await contexts.record({ scope: "club", text: "Original" });
    await contexts.change({ context, text: "Officer A", expectedVersion: 1 });
    await expect(contexts.change({ context, text: "Officer B stale draft", expectedVersion: 1 })).rejects.toBeInstanceOf(ContextVersionConflict);
    expect(await contexts._get({ context })).toEqual([{ scope: "club", text: "Officer A" }]);
    expect(await contexts._changes({ context })).toHaveLength(1);
  });

  test("a stale answer revision cannot overwrite the current answer", async () => {
    const { question } = await questions.ask({ subject: "subject", text: "Can this change?" });
    await questions.answer({ question, answer: "First", answerer: "officer", expectedVersion: 1 });
    await questions.reviseAnswer({ question, answer: "Second", answerer: "officer", expectedVersion: 2 });
    await expect(questions.reviseAnswer({ question, answer: "Stale", answerer: "officer", expectedVersion: 2 })).rejects.toBeInstanceOf(QuestionVersionConflict);
    expect((await questions._get({ question }))[0].answer).toBe("Second");
  });

  test("a stale Review decision does not change the current lifecycle state", async () => {
    const { review } = await reviews.request({ item: "playbook", cause: "cause" });
    await reviews.addCause({ review, cause: "new-cause" });
    await expect(reviews.confirm({ review, expectedVersion: 1 })).rejects.toBeInstanceOf(ReviewVersionConflict);
    expect(await reviews._get({ review })).toEqual([{ item: "playbook", status: "PENDING" }]);
  });
});
