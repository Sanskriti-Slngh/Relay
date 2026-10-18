import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { db } from "../../src/db.ts";
import {
  QuestionAnswerNotEditable,
  QuestioningConcept,
  QuestionNotFound,
  QuestionNotOpen,
} from "../../src/concepts/Questioning.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = db.databaseName;
const testDatabaseName = `relay_questioning_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The Questioning test database must be isolated from application data.");
}

const testDb = testClient.db(testDatabaseName);
const concept = new QuestioningConcept(testDb, testClient, "questioningTest");

describe("Questioning concept", () => {
  beforeAll(async () => {
    await testClient.connect();
    await testDb.command({ ping: 1 });
  });

  afterAll(async () => {
    try {
      await testClient.db(testDatabaseName).dropDatabase();
      const remaining = await testClient.db("admin").command({
        listDatabases: 1,
        nameOnly: true,
        filter: { name: testDatabaseName },
      });
      expect(remaining.databases).toEqual([]);
    } finally {
      await testClient.close();
    }
  });

  test("uses a unique database separate from configured application data", () => {
    expect(testDatabaseName).not.toBe(applicationDatabaseName);
    expect(testDatabaseName).toMatch(/^relay_questioning_tests_[a-f0-9]+$/);
  });

  test("asks an OPEN Question about a stable Subject", async () => {
    const { question } = await concept.ask({
      subject: "stable-step-identity",
      text: "Does this still happen before payment?",
    });

    expect(question).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await concept._get({ question })).toEqual([{
      subject: "stable-step-identity",
      text: "Does this still happen before payment?",
      status: "OPEN",
    }]);
    expect(await concept._forSubject({ subject: "stable-step-identity" })).toEqual([{
      question,
      text: "Does this still happen before payment?",
      status: "OPEN",
    }]);
    expect(await concept._open()).toContainEqual({
      question,
      subject: "stable-step-identity",
      text: "Does this still happen before payment?",
    });
  });

  test("answers once while preserving the original Question and Subject", async () => {
    const { question } = await concept.ask({ subject: "context-note", text: "Why is this required?" });

    expect(await concept.answer({
      question,
      answer: "The venue contract requires it.",
      answerer: "officer-one",
    })).toEqual({});
    expect(await concept._get({ question })).toEqual([{
      subject: "context-note",
      text: "Why is this required?",
      status: "ANSWERED",
      answer: "The venue contract requires it.",
      answerer: "officer-one",
    }]);
    expect(await concept._forSubject({ subject: "context-note" })).toEqual([{
      question,
      text: "Why is this required?",
      status: "ANSWERED",
      answer: "The venue contract requires it.",
      answerer: "officer-one",
    }]);
    expect(await concept._open()).not.toContainEqual(expect.objectContaining({ question }));
  });

  test("keeps multiple Questions and Subjects independent", async () => {
    const first = await concept.ask({ subject: "shared-subject", text: "First question?" });
    const second = await concept.ask({ subject: "shared-subject", text: "Second question?" });
    const other = await concept.ask({ subject: "other-subject", text: "Other question?" });
    await concept.answer({ question: first.question, answer: "First answer.", answerer: "officer-one" });

    const shared = await concept._forSubject({ subject: "shared-subject" });
    expect(shared).toHaveLength(2);
    expect(shared).toContainEqual(expect.objectContaining({ question: first.question, status: "ANSWERED" }));
    expect(shared).toContainEqual({ question: second.question, text: "Second question?", status: "OPEN" });
    expect(await concept._forSubject({ subject: "other-subject" })).toEqual([{
      question: other.question,
      text: "Other question?",
      status: "OPEN",
    }]);
    expect(await concept._questions()).toEqual(expect.arrayContaining([
      expect.objectContaining({ question: first.question, subject: "shared-subject" }),
      expect.objectContaining({ question: second.question, subject: "shared-subject" }),
      expect.objectContaining({ question: other.question, subject: "other-subject" }),
    ]));
  });

  test("refuses missing Questions and repeat answers without changing the first answer", async () => {
    await expect(concept.answer({ question: "missing-question", answer: "No", answerer: "officer-one" })).rejects
      .toBeInstanceOf(QuestionNotFound);

    const { question } = await concept.ask({ subject: "repeat-subject", text: "One answer?" });
    await concept.answer({ question, answer: "Original answer.", answerer: "officer-one" });
    await expect(concept.answer({ question, answer: "Replacement answer.", answerer: "officer-one" })).rejects
      .toBeInstanceOf(QuestionNotOpen);
    expect(await concept._get({ question })).toEqual([{
      subject: "repeat-subject",
      text: "One answer?",
      status: "ANSWERED",
      answer: "Original answer.",
      answerer: "officer-one",
    }]);
    expect(await concept._get({ question: "missing-question" })).toEqual([]);
    expect(await concept._forSubject({ subject: "missing-subject" })).toEqual([]);
  });

  test("lets only the original answerer revise an answered Question", async () => {
    const { question } = await concept.ask({ subject: "owned-answer", text: "Who owns edits?" });
    await expect(concept.reviseAnswer({
      question,
      answer: "Too early.",
      answerer: "officer-one",
    })).rejects.toBeInstanceOf(QuestionAnswerNotEditable);

    await concept.answer({ question, answer: "Original answer.", answerer: "officer-one" });
    await expect(concept.reviseAnswer({
      question,
      answer: "Unauthorized replacement.",
      answerer: "officer-two",
    })).rejects.toBeInstanceOf(QuestionAnswerNotEditable);
    await expect(concept.reviseAnswer({
      question: "missing-question",
      answer: "Missing.",
      answerer: "officer-one",
    })).rejects.toBeInstanceOf(QuestionNotFound);

    expect(await concept.reviseAnswer({
      question,
      answer: "Corrected answer.",
      answerer: "officer-one",
    })).toEqual({});
    expect(await concept._get({ question })).toEqual([{
      subject: "owned-answer",
      text: "Who owns edits?",
      status: "ANSWERED",
      answer: "Corrected answer.",
      answerer: "officer-one",
    }]);
  });

  test("allows only one of two concurrent answers to become the preserved answer", async () => {
    const { question } = await concept.ask({ subject: "concurrent-subject", text: "Which answer wins?" });
    const outcomes = await Promise.allSettled([
      concept.answer({ question, answer: "Answer A", answerer: "officer-a" }),
      concept.answer({ question, answer: "Answer B", answerer: "officer-b" }),
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const [stored] = await concept._get({ question });
    expect(stored.status).toBe("ANSWERED");
    expect(stored.answer === "Answer A" || stored.answer === "Answer B").toBe(true);
  });
});
