import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  AttachmentAlreadyExists,
  AttachmentNotFound,
  ChangeNotDifferent,
  ContextNotFound,
  ContextTrackingConcept,
} from "../../src/concepts/ContextTracking.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = testClient.db().databaseName;
const testDatabaseName = `relay_context_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The ContextTracking test database must be isolated from application data.");
}

const testDb = testClient.db(testDatabaseName);
const concept = new ContextTrackingConcept(testDb, testClient);

describe("ContextTracking concept", () => {
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
    expect(testDatabaseName).toMatch(/^relay_context_tests_[a-f0-9]+$/);
  });

  test("records and retrieves ContextNotes by scope and identity", async () => {
    const first = await concept.record({ scope: "club-a", text: "First shared note" });
    const second = await concept.record({ scope: "club-a", text: "Second shared note" });
    const otherScope = await concept.record({ scope: "club-b", text: "Other club note" });

    expect(first.context).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(new Set([first.context, second.context, otherScope.context]).size).toBe(3);
    expect(await concept._get({ context: first.context })).toEqual([
      { scope: "club-a", text: "First shared note" },
    ]);
    expect(await concept._notes({ scope: "club-a" })).toHaveLength(2);
    expect(new Set((await concept._notes({ scope: "club-a" })).map(({ context }) => context))).toEqual(
      new Set([first.context, second.context]),
    );
    expect(await concept._notes({ scope: "missing-scope" })).toEqual([]);
    expect(await concept._get({ context: "missing-context" })).toEqual([]);
    expect(await concept._notes({ scope: "club-b" })).toEqual([
      { context: otherScope.context, text: "Other club note" },
    ]);
  });

  test("attaches a note without an anchor and at specific anchors", async () => {
    const { context } = await concept.record({ scope: "club", text: "Shared setup" });
    const unanchored = await concept.attach({ context, subject: "procedure-1" });
    const firstAnchor = await concept.attachAt({
      context,
      subject: "procedure-1",
      anchor: "step-1",
    });
    const secondAnchor = await concept.attachAt({
      context,
      subject: "procedure-1",
      anchor: "step-2",
    });

    expect(await concept._getAttachment({ attachment: unanchored.attachment })).toEqual([
      { context, subject: "procedure-1" },
    ]);
    expect(await concept._getAttachment({ attachment: firstAnchor.attachment })).toEqual([
      { context, subject: "procedure-1", anchor: "step-1" },
    ]);
    const attachments = await concept._attachments({ context });
    expect(attachments).toEqual([
      { attachment: unanchored.attachment, subject: "procedure-1" },
      { attachment: firstAnchor.attachment, subject: "procedure-1", anchor: "step-1" },
      { attachment: secondAnchor.attachment, subject: "procedure-1", anchor: "step-2" },
    ].sort((left, right) => left.attachment.localeCompare(right.attachment)));
    expect(await concept._getAttachment({ attachment: "missing-attachment" })).toEqual([]);
  });

  test("rejects duplicate unanchored and same-anchor attachments but allows distinct anchors", async () => {
    const { context } = await concept.record({ scope: "club", text: "Attachment uniqueness" });
    await concept.attach({ context, subject: "procedure-2" });
    await concept.attachAt({ context, subject: "procedure-2", anchor: "step-a" });

    await expect(concept.attach({ context, subject: "procedure-2" })).rejects
      .toBeInstanceOf(AttachmentAlreadyExists);
    await expect(
      concept.attachAt({ context, subject: "procedure-2", anchor: "step-a" }),
    ).rejects.toBeInstanceOf(AttachmentAlreadyExists);

    const distinct = await concept.attachAt({
      context,
      subject: "procedure-2",
      anchor: "step-b",
    });
    expect(await concept._getAttachment({ attachment: distinct.attachment })).toEqual([
      { context, subject: "procedure-2", anchor: "step-b" },
    ]);
    expect(await concept._attachments({ context })).toHaveLength(3);
  });

  test("detaches an Attachment and refuses to detach an unknown identity", async () => {
    const { context } = await concept.record({ scope: "club", text: "Detachment" });
    const { attachment } = await concept.attach({ context, subject: "procedure-3" });

    expect(await concept.detach({ attachment })).toEqual({});
    expect(await concept._getAttachment({ attachment })).toEqual([]);
    expect(await concept._attachments({ context })).toEqual([]);
    await expect(concept.detach({ attachment: "missing-attachment" })).rejects
      .toBeInstanceOf(AttachmentNotFound);
  });

  test("refuses attachments, corrections, and changes for nonexistent ContextNotes", async () => {
    await expect(concept.attach({ context: "missing-context", subject: "procedure" })).rejects
      .toBeInstanceOf(ContextNotFound);
    await expect(
      concept.attachAt({
        context: "missing-context",
        subject: "procedure",
        anchor: "step",
      }),
    ).rejects.toBeInstanceOf(ContextNotFound);
    await expect(concept.correct({ context: "missing-context", text: "No note" })).rejects
      .toBeInstanceOf(ContextNotFound);
    await expect(concept.change({ context: "missing-context", text: "No note" })).rejects
      .toBeInstanceOf(ContextNotFound);

    expect(await concept._attachments({ context: "missing-context" })).toEqual([]);
    expect(await concept._changes({ context: "missing-context" })).toEqual([]);
  });

  test("corrects text without creating a Change record", async () => {
    const { context } = await concept.record({ scope: "club", text: "Initial typo" });

    expect(await concept.correct({ context, text: "Corrected wording" })).toEqual({});
    expect(await concept._get({ context })).toEqual([
      { scope: "club", text: "Corrected wording" },
    ]);
    expect(await concept._changes({ context })).toEqual([]);
  });

  test("changes text and preserves the exact before and after values", async () => {
    const { context } = await concept.record({
      scope: "club",
      text: "Do the inspection before opening.",
    });

    const { change } = await concept.change({
      context,
      text: "Do the inspection after opening.",
    });

    expect(await concept._get({ context })).toEqual([
      { scope: "club", text: "Do the inspection after opening." },
    ]);
    expect(await concept._changes({ context })).toEqual([
      {
        change,
        before: "Do the inspection before opening.",
        after: "Do the inspection after opening.",
      },
    ]);
    expect(await concept._getChange({ change })).toEqual([
      {
        context,
        before: "Do the inspection before opening.",
        after: "Do the inspection after opening.",
      },
    ]);
    expect(await concept._getChange({ change: "missing-change" })).toEqual([]);
  });

  test("rejects an unchanged meaningful change without partial state", async () => {
    const { context } = await concept.record({ scope: "club", text: "Unchanged text" });
    const notesBefore = await concept._get({ context });
    const changesBefore = await concept._changes({ context });

    await expect(concept.change({ context, text: "Unchanged text" })).rejects
      .toBeInstanceOf(ChangeNotDifferent);

    expect(await concept._get({ context })).toEqual(notesBefore);
    expect(await concept._changes({ context })).toEqual(changesBefore);
  });

  test("records consecutive Changes as an exact before/after chain", async () => {
    const { context } = await concept.record({ scope: "club", text: "Version zero" });
    const first = await concept.change({ context, text: "Version one" });
    const second = await concept.change({ context, text: "Version two" });
    const third = await concept.change({ context, text: "Version three" });

    const history = await concept._changes({ context });
    const expected = new Map([
      [first.change, { before: "Version zero", after: "Version one" }],
      [second.change, { before: "Version one", after: "Version two" }],
      [third.change, { before: "Version two", after: "Version three" }],
    ]);
    expect(history.map(({ change }) => change)).toEqual([...expected.keys()].sort());
    for (const entry of history) {
      expect(expected.get(entry.change)).toEqual({ before: entry.before, after: entry.after });
    }

    const nextByBefore = new Map(history.map((entry) => [entry.before, entry]));
    let currentText = "Version zero";
    const visitedChanges = new Set<string>();
    while (nextByBefore.has(currentText)) {
      const entry = nextByBefore.get(currentText)!;
      expect(visitedChanges.has(entry.change)).toBe(false);
      visitedChanges.add(entry.change);
      currentText = entry.after;
    }
    expect(visitedChanges.size).toBe(history.length);
    expect(currentText).toBe("Version three");
    expect(await concept._get({ context })).toEqual([
      { scope: "club", text: "Version three" },
    ]);
  });

  test("concurrent Changes preserve a complete history without assuming Change ID order", async () => {
    const initialText = "Concurrent starting point";
    const { context } = await concept.record({ scope: "club", text: initialText });
    const requestedTexts = Array.from({ length: 8 }, (_, index) => `Concurrent result ${index}`);

    await Promise.all(
      requestedTexts.map((text) => concept.change({ context, text })),
    );

    const history = await concept._changes({ context });
    expect(history).toHaveLength(requestedTexts.length);
    expect(new Set(history.map(({ change }) => change)).size).toBe(history.length);
    expect(new Set(history.map(({ after }) => after))).toEqual(new Set(requestedTexts));
    expect(history.every(({ before, after }) => before !== after)).toBe(true);

    const afterValues = new Set(history.map(({ after }) => after));
    const byBefore = new Map<string, (typeof history)[number]>();
    for (const entry of history) {
      expect(byBefore.has(entry.before)).toBe(false);
      byBefore.set(entry.before, entry);
      expect(entry.before === initialText || afterValues.has(entry.before)).toBe(true);
    }

    let expectedText = initialText;
    const visitedChanges = new Set<string>();
    while (byBefore.has(expectedText)) {
      const entry = byBefore.get(expectedText)!;
      expect(visitedChanges.has(entry.change)).toBe(false);
      visitedChanges.add(entry.change);
      expectedText = entry.after;
    }

    expect(visitedChanges.size).toBe(history.length);
    expect(await concept._get({ context })).toEqual([{ scope: "club", text: expectedText }]);
  });
});
