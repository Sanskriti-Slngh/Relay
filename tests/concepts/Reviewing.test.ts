import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  AddCauseReviewFinished,
  AddCauseReviewNotFound,
  CancelReviewFinished,
  CancelReviewNotFound,
  CauseAlreadyPresent,
  ConfirmReviewNotFound,
  RequestAlreadyUnfinished,
  RequireChangesReviewNotFound,
  ResolveReviewNotFound,
  ReviewNotAwaitingChanges,
  ReviewNotPendingForChanges,
  ReviewNotPendingForConfirmation,
  ReviewingConcept,
} from "../../src/concepts/Reviewing.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = testClient.db().databaseName;
const testDatabaseName = `relay_reviewing_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The Reviewing test database must be isolated from application data.");
}

const testDb = testClient.db(testDatabaseName);
const concept = new ReviewingConcept(testDb, testClient);

type ActionOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function capture<T>(action: Promise<T>): Promise<ActionOutcome<T>> {
  try {
    return { ok: true, value: await action };
  } catch (error) {
    return { ok: false, error };
  }
}

describe("Reviewing concept", () => {
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
    expect(testDatabaseName).toMatch(/^relay_reviewing_tests_[a-f0-9]+$/);
  });

  test("requests a PENDING Review and retrieves its Item, status, and initial Cause", async () => {
    const { review } = await concept.request({ item: "procedure-one", cause: "change-one" });

    expect(review).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(await concept._get({ review })).toEqual([{ item: "procedure-one", status: "PENDING" }]);
    expect(await concept._unfinished()).toContainEqual({
      review,
      item: "procedure-one",
      status: "PENDING",
    });
    expect(await concept._forItem({ item: "procedure-one" })).toContainEqual({
      review,
      status: "PENDING",
    });
    expect(await concept._causes({ review })).toEqual([{ cause: "change-one" }]);
    expect(await concept._get({ review: "missing-review" })).toEqual([]);
    expect(await concept._forItem({ item: "item-without-reviews" })).toEqual([]);
    expect(await concept._causes({ review: "missing-review" })).toEqual([]);
  });

  test("keeps unfinished Reviews independent for different Items", async () => {
    const first = await concept.request({ item: "independent-item-a", cause: "cause-a" });
    const second = await concept.request({ item: "independent-item-b", cause: "cause-b" });

    expect(first.review).not.toBe(second.review);
    expect(await concept._get({ review: first.review })).toEqual([
      { item: "independent-item-a", status: "PENDING" },
    ]);
    expect(await concept._get({ review: second.review })).toEqual([
      { item: "independent-item-b", status: "PENDING" },
    ]);
  });

  test("refuses a second unfinished Review for the same Item", async () => {
    const { review } = await concept.request({ item: "duplicate-request-item", cause: "first-cause" });

    await expect(
      concept.request({ item: "duplicate-request-item", cause: "second-cause" }),
    ).rejects.toBeInstanceOf(RequestAlreadyUnfinished);

    expect(await concept._forItem({ item: "duplicate-request-item" })).toEqual([
      { review, status: "PENDING" },
    ]);
    expect(await concept._causes({ review })).toEqual([{ cause: "first-cause" }]);
  });

  test("adds distinct Causes and refuses a Cause already present", async () => {
    const { review } = await concept.request({ item: "cause-item", cause: "cause-original" });
    const additionalCauses = ["cause-second", "cause-third", "cause-fourth"];

    for (const cause of additionalCauses) {
      expect(await concept.addCause({ review, cause })).toEqual({});
    }
    await expect(concept.addCause({ review, cause: "cause-third" })).rejects
      .toBeInstanceOf(CauseAlreadyPresent);

    expect(await concept._causes({ review })).toEqual(
      ["cause-original", ...additionalCauses].sort().map((cause) => ({ cause })),
    );
    expect(await concept._get({ review })).toEqual([{ item: "cause-item", status: "PENDING" }]);
  });

  test("confirms a PENDING Review and permits a new Review after it finishes", async () => {
    const first = await concept.request({ item: "confirmed-item", cause: "confirmation-cause" });

    expect(await concept.confirm({ review: first.review })).toEqual({});
    expect(await concept._get({ review: first.review })).toEqual([
      { item: "confirmed-item", status: "COMPLETE" },
    ]);
    expect(await concept._unfinished()).not.toContainEqual({
      review: first.review,
      item: "confirmed-item",
      status: "COMPLETE",
    });

    const second = await concept.request({ item: "confirmed-item", cause: "new-cycle-cause" });
    expect(second.review).not.toBe(first.review);
    expect(await concept._forItem({ item: "confirmed-item" })).toHaveLength(2);
    expect(await concept._unfinished()).toContainEqual({
      review: second.review,
      item: "confirmed-item",
      status: "PENDING",
    });
  });

  test("transitions PENDING to CHANGES_REQUIRED to COMPLETE", async () => {
    const { review } = await concept.request({ item: "resolve-item", cause: "resolve-cause" });

    expect(await concept.requireChanges({ review })).toEqual({});
    expect(await concept._get({ review })).toEqual([
      { item: "resolve-item", status: "CHANGES_REQUIRED" },
    ]);
    expect(await concept._unfinished()).toContainEqual({
      review,
      item: "resolve-item",
      status: "CHANGES_REQUIRED",
    });

    expect(await concept.resolve({ review })).toEqual({});
    expect(await concept._get({ review })).toEqual([
      { item: "resolve-item", status: "COMPLETE" },
    ]);
    expect(await concept._unfinished()).not.toContainEqual({
      review,
      item: "resolve-item",
      status: "COMPLETE",
    });
  });

  test("cancels Reviews from PENDING and CHANGES_REQUIRED", async () => {
    const pending = await concept.request({ item: "cancel-pending", cause: "pending-cause" });
    expect(await concept.cancel({ review: pending.review })).toEqual({});
    expect(await concept._get({ review: pending.review })).toEqual([
      { item: "cancel-pending", status: "CANCELLED" },
    ]);

    const awaitingChanges = await concept.request({
      item: "cancel-changes",
      cause: "changes-cause",
    });
    await concept.requireChanges({ review: awaitingChanges.review });
    expect(await concept.cancel({ review: awaitingChanges.review })).toEqual({});
    expect(await concept._get({ review: awaitingChanges.review })).toEqual([
      { item: "cancel-changes", status: "CANCELLED" },
    ]);
    expect(await concept._unfinished()).not.toContainEqual({
      review: pending.review,
      item: "cancel-pending",
      status: "CANCELLED",
    });
    expect(await concept._unfinished()).not.toContainEqual({
      review: awaitingChanges.review,
      item: "cancel-changes",
      status: "CANCELLED",
    });
  });

  test("uses the specified refusal class for every missing-Review action", async () => {
    await expect(concept.addCause({ review: "missing-add-cause", cause: "cause" })).rejects
      .toBeInstanceOf(AddCauseReviewNotFound);
    await expect(concept.confirm({ review: "missing-confirm" })).rejects
      .toBeInstanceOf(ConfirmReviewNotFound);
    await expect(concept.requireChanges({ review: "missing-require-changes" })).rejects
      .toBeInstanceOf(RequireChangesReviewNotFound);
    await expect(concept.resolve({ review: "missing-resolve" })).rejects
      .toBeInstanceOf(ResolveReviewNotFound);
    await expect(concept.cancel({ review: "missing-cancel" })).rejects
      .toBeInstanceOf(CancelReviewNotFound);
  });

  test("refuses illegal lifecycle operations without changing status or Causes", async () => {
    const pending = await concept.request({ item: "illegal-pending", cause: "keep-pending" });
    const pendingBefore = {
      state: await concept._get({ review: pending.review }),
      causes: await concept._causes({ review: pending.review }),
    };

    await expect(concept.resolve({ review: pending.review })).rejects
      .toBeInstanceOf(ReviewNotAwaitingChanges);
    expect(await concept._get({ review: pending.review })).toEqual(pendingBefore.state);
    expect(await concept._causes({ review: pending.review })).toEqual(pendingBefore.causes);
    await expect(concept.confirm({ review: pending.review })).resolves.toEqual({});
    expect(await concept._get({ review: pending.review })).toEqual([
      { item: "illegal-pending", status: "COMPLETE" },
    ]);
    expect(await concept._causes({ review: pending.review })).toEqual(pendingBefore.causes);
    await expect(concept.requireChanges({ review: pending.review })).rejects
      .toBeInstanceOf(ReviewNotPendingForChanges);
    await expect(concept.cancel({ review: pending.review })).rejects
      .toBeInstanceOf(CancelReviewFinished);
    await expect(concept.addCause({ review: pending.review, cause: "late-cause" })).rejects
      .toBeInstanceOf(AddCauseReviewFinished);

    const awaitingChanges = await concept.request({
      item: "illegal-changes",
      cause: "keep-changes",
    });
    await concept.requireChanges({ review: awaitingChanges.review });
    const changesBefore = {
      state: await concept._get({ review: awaitingChanges.review }),
      causes: await concept._causes({ review: awaitingChanges.review }),
    };

    await expect(concept.confirm({ review: awaitingChanges.review })).rejects
      .toBeInstanceOf(ReviewNotPendingForConfirmation);
    await expect(concept.requireChanges({ review: awaitingChanges.review })).rejects
      .toBeInstanceOf(ReviewNotPendingForChanges);
    await expect(concept.addCause({ review: awaitingChanges.review, cause: "keep-changes" })).rejects
      .toBeInstanceOf(CauseAlreadyPresent);
    expect(await concept._get({ review: awaitingChanges.review })).toEqual(changesBefore.state);
    expect(await concept._causes({ review: awaitingChanges.review })).toEqual(changesBefore.causes);

    await concept.resolve({ review: awaitingChanges.review });
    const complete = {
      state: await concept._get({ review: awaitingChanges.review }),
      causes: await concept._causes({ review: awaitingChanges.review }),
    };
    await expect(concept.resolve({ review: awaitingChanges.review })).rejects
      .toBeInstanceOf(ReviewNotAwaitingChanges);
    await expect(concept.confirm({ review: awaitingChanges.review })).rejects
      .toBeInstanceOf(ReviewNotPendingForConfirmation);
    await expect(concept.cancel({ review: awaitingChanges.review })).rejects
      .toBeInstanceOf(CancelReviewFinished);
    await expect(
      concept.addCause({ review: awaitingChanges.review, cause: "after-completion" }),
    ).rejects.toBeInstanceOf(AddCauseReviewFinished);
    expect(await concept._get({ review: awaitingChanges.review })).toEqual(complete.state);
    expect(await concept._causes({ review: awaitingChanges.review })).toEqual(complete.causes);

    const cancelled = await concept.request({ item: "illegal-cancelled", cause: "cancelled-cause" });
    await concept.cancel({ review: cancelled.review });
    const cancelledBefore = {
      state: await concept._get({ review: cancelled.review }),
      causes: await concept._causes({ review: cancelled.review }),
    };
    await expect(concept.cancel({ review: cancelled.review })).rejects
      .toBeInstanceOf(CancelReviewFinished);
    await expect(concept.confirm({ review: cancelled.review })).rejects
      .toBeInstanceOf(ReviewNotPendingForConfirmation);
    await expect(concept.requireChanges({ review: cancelled.review })).rejects
      .toBeInstanceOf(ReviewNotPendingForChanges);
    await expect(concept.resolve({ review: cancelled.review })).rejects
      .toBeInstanceOf(ReviewNotAwaitingChanges);
    await expect(concept.addCause({ review: cancelled.review, cause: "after-cancel" })).rejects
      .toBeInstanceOf(AddCauseReviewFinished);
    expect(await concept._get({ review: cancelled.review })).toEqual(cancelledBefore.state);
    expect(await concept._causes({ review: cancelled.review })).toEqual(cancelledBefore.causes);
    expect(await concept._get({ review: pending.review })).not.toEqual(pendingBefore.state);
  });

  test("concurrent requests create exactly one unfinished Review for one Item", async () => {
    const item = "concurrent-request-item";
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        capture(concept.request({ item, cause: `request-cause-${index}` })),
      ),
    );
    const successes = outcomes.filter(
      (outcome): outcome is { ok: true; value: { review: string } } => outcome.ok,
    );
    const refusals = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(7);
    for (const refusal of refusals) {
      if (refusal.ok) throw new Error("Expected concurrent request to be refused.");
      expect(refusal.error).toBeInstanceOf(RequestAlreadyUnfinished);
    }

    const [successful] = successes;
    expect(await concept._forItem({ item })).toEqual([
      { review: successful.value.review, status: "PENDING" },
    ]);
    expect(await concept._unfinished()).toContainEqual({
      review: successful.value.review,
      item,
      status: "PENDING",
    });
  });

  test("concurrent distinct Causes are all retained exactly once", async () => {
    const { review } = await concept.request({
      item: "concurrent-add-causes-item",
      cause: "original-cause",
    });
    const causes = Array.from({ length: 8 }, (_, index) => `parallel-cause-${index}`);
    const results = await Promise.all(
      causes.map((cause) => concept.addCause({ review, cause })),
    );

    expect(results).toEqual(Array.from({ length: causes.length }, () => ({})));
    const persistedCauses = (await concept._causes({ review })).map(({ cause }) => cause);
    expect(persistedCauses).toHaveLength(causes.length + 1);
    expect(new Set(persistedCauses).size).toBe(causes.length + 1);
    expect(new Set(persistedCauses)).toEqual(new Set(["original-cause", ...causes]));
  });

  test("concurrent duplicate Cause additions do not duplicate the Cause", async () => {
    const { review } = await concept.request({
      item: "concurrent-duplicate-cause-item",
      cause: "initial-cause",
    });
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => capture(concept.addCause({ review, cause: "shared-cause" }))),
    );
    const successes = outcomes.filter((outcome) => outcome.ok);
    const refusals = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(7);
    for (const refusal of refusals) {
      if (refusal.ok) throw new Error("Expected duplicate Cause addition to be refused.");
      expect(refusal.error).toBeInstanceOf(CauseAlreadyPresent);
    }
    expect(await concept._causes({ review })).toEqual([
      { cause: "initial-cause" },
      { cause: "shared-cause" },
    ]);
  });

  test("racing incompatible lifecycle transitions commits only one legal transition", async () => {
    const { review } = await concept.request({
      item: "concurrent-lifecycle-item",
      cause: "lifecycle-cause",
    });
    const outcomes = await Promise.all([
      capture(concept.confirm({ review })),
      capture(concept.requireChanges({ review })),
    ]);
    const successes = outcomes.filter((outcome) => outcome.ok);
    const refusals = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(1);
    const refusal = refusals[0];
    if (refusal.ok) throw new Error("Expected one incompatible transition to be refused.");
    expect([
      ReviewNotPendingForConfirmation,
      ReviewNotPendingForChanges,
    ].some((ErrorClass) => refusal.error instanceof ErrorClass)).toBe(true);

    const stored = await concept._get({ review });
    expect(stored).toHaveLength(1);
    expect(["COMPLETE", "CHANGES_REQUIRED"]).toContain(stored[0].status);
    expect(await concept._causes({ review })).toEqual([{ cause: "lifecycle-cause" }]);
    const unfinishedForRaceItem = (await concept._unfinished()).filter(
      ({ item }) => item === "concurrent-lifecycle-item",
    );
    if (stored[0].status === "COMPLETE") {
      expect(unfinishedForRaceItem).toEqual([]);
    } else {
      expect(unfinishedForRaceItem).toEqual([
        { review, item: "concurrent-lifecycle-item", status: "CHANGES_REQUIRED" },
      ]);
    }
  });
});
