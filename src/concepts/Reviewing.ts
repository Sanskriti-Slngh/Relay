import {
  MongoServerError,
  type Collection,
  type Db,
  type Document,
  type MongoClient,
} from "mongodb";
import { connectToDatabase, db, mongoClient } from "../db.ts";

type ReviewStatus = "PENDING" | "CHANGES_REQUIRED" | "COMPLETE" | "CANCELLED";

type ReviewDocument = Document & {
  _id: string;
  item: string;
  causes: string[];
  status: ReviewStatus;
  version: number;
};

type ReviewingStorage = {
  db: Db;
  mongoClient: MongoClient;
  reviews: Collection<ReviewDocument>;
  indexesReady?: Promise<void>;
};

export class RequestAlreadyUnfinished extends Error {}
export class AddCauseReviewNotFound extends Error {}
export class AddCauseReviewFinished extends Error {}
export class CauseAlreadyPresent extends Error {}
export class ConfirmReviewNotFound extends Error {}
export class ReviewNotPendingForConfirmation extends Error {}
export class RequireChangesReviewNotFound extends Error {}
export class ReviewNotPendingForChanges extends Error {}
export class ResolveReviewNotFound extends Error {}
export class ReviewNotAwaitingChanges extends Error {}
export class CancelReviewNotFound extends Error {}
export class CancelReviewFinished extends Error {}
export class VersionConflict extends Error {}

async function ensureConnected(storage: ReviewingStorage): Promise<void> {
  if (storage.db === db && storage.mongoClient === mongoClient) {
    await connectToDatabase();
  } else {
    await storage.mongoClient.connect();
    await storage.db.command({ ping: 1 });
  }
}

async function ensureStorage(storage: ReviewingStorage): Promise<void> {
  await ensureConnected(storage);
  storage.indexesReady ??= Promise.all([
    storage.reviews.updateMany({ version: { $exists: false } }, { $set: { version: 1 } }),
    storage.reviews.createIndex(
      { item: 1 },
      {
        name: "one_unfinished_review_per_item",
        unique: true,
        partialFilterExpression: {
          status: { $in: ["PENDING", "CHANGES_REQUIRED"] },
        },
      },
    ),
    storage.reviews.createIndex(
      { item: 1, _id: 1 },
      { name: "reviews_item_identity" },
    ),
  ]).then(() => undefined);
  await storage.indexesReady;
}

function isUnfinishedReviewUniquenessViolation(error: unknown): boolean {
  if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
  return error.keyPattern?.item === 1;
}

export class ReviewingConcept {
  private readonly storage: ReviewingStorage;

  constructor(database: Db = db, client: MongoClient = mongoClient) {
    this.storage = {
      db: database,
      mongoClient: client,
      reviews: database.collection<ReviewDocument>("reviewing_reviews"),
    };
  }

  async request({
    item,
    cause,
  }: {
    item: string;
    cause: string;
  }): Promise<{ review: string }> {
    await ensureStorage(this.storage);
    const review = crypto.randomUUID();
    try {
      await this.storage.reviews.insertOne({
        _id: review,
        item,
        causes: [cause],
        status: "PENDING",
        version: 1,
      });
    } catch (error) {
      if (isUnfinishedReviewUniquenessViolation(error)) {
        throw new RequestAlreadyUnfinished(
          "This Item already has an unfinished Review; add the cause to that Review.",
        );
      }
      throw error;
    }
    return { review };
  }

  async addCause({
    review,
    cause,
  }: {
    review: string;
    cause: string;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.reviews.updateOne(
      {
        _id: review,
        status: { $in: ["PENDING", "CHANGES_REQUIRED"] },
        causes: { $ne: cause },
      },
      { $addToSet: { causes: cause }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const current = await this.storage.reviews.findOne({ _id: review });
    if (current === null) {
      throw new AddCauseReviewNotFound("There is no such Review.");
    }
    if (current.status === "COMPLETE" || current.status === "CANCELLED") {
      throw new AddCauseReviewFinished("Causes can only be added to an unfinished Review.");
    }
    throw new CauseAlreadyPresent("That cause is already associated with the Review.");
  }

  async confirm({ review, expectedVersion }: { review: string; expectedVersion?: number }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.reviews.updateOne(
      { _id: review, status: "PENDING", ...(!expectedVersion ? {} : { version: expectedVersion }) },
      { $set: { status: "COMPLETE" }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const current = await this.storage.reviews.findOne({ _id: review }, { projection: { status: 1, version: 1 } });
    if (!current) {
      throw new ConfirmReviewNotFound("There is no such Review.");
    }
    if (current.status === "PENDING") throw new VersionConflict("The Review changed after it was loaded.");
    throw new ReviewNotPendingForConfirmation("Only a PENDING Review can be confirmed.");
  }

  async requireChanges({ review, expectedVersion }: { review: string; expectedVersion?: number }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.reviews.updateOne(
      { _id: review, status: "PENDING", ...(!expectedVersion ? {} : { version: expectedVersion }) },
      { $set: { status: "CHANGES_REQUIRED" }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const current = await this.storage.reviews.findOne({ _id: review }, { projection: { status: 1, version: 1 } });
    if (!current) {
      throw new RequireChangesReviewNotFound("There is no such Review.");
    }
    if (current.status === "PENDING") throw new VersionConflict("The Review changed after it was loaded.");
    throw new ReviewNotPendingForChanges(
      "Only a PENDING Review can be marked as requiring changes.",
    );
  }

  async resolve({ review, expectedVersion }: { review: string; expectedVersion?: number }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.reviews.updateOne(
      { _id: review, status: "CHANGES_REQUIRED", ...(!expectedVersion ? {} : { version: expectedVersion }) },
      { $set: { status: "COMPLETE" }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const current = await this.storage.reviews.findOne({ _id: review }, { projection: { status: 1, version: 1 } });
    if (!current) {
      throw new ResolveReviewNotFound("There is no such Review.");
    }
    if (current.status === "CHANGES_REQUIRED") throw new VersionConflict("The Review changed after it was loaded.");
    throw new ReviewNotAwaitingChanges(
      "Only a Review requiring changes can be resolved.",
    );
  }

  async cancel({ review, expectedVersion }: { review: string; expectedVersion?: number }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.reviews.updateOne(
      { _id: review, status: { $in: ["PENDING", "CHANGES_REQUIRED"] }, ...(!expectedVersion ? {} : { version: expectedVersion }) },
      { $set: { status: "CANCELLED" }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const current = await this.storage.reviews.findOne({ _id: review }, { projection: { status: 1, version: 1 } });
    if (!current) {
      throw new CancelReviewNotFound("There is no such Review.");
    }
    if (current.status === "PENDING" || current.status === "CHANGES_REQUIRED") throw new VersionConflict("The Review changed after it was loaded.");
    throw new CancelReviewFinished("Only an unfinished Review can be cancelled.");
  }

  async _unfinished(): Promise<
    { review: string; item: string; status: ReviewStatus }[]
  > {
    await ensureConnected(this.storage);
    const found = await this.storage.reviews
      .find({ status: { $in: ["PENDING", "CHANGES_REQUIRED"] } })
      .sort({ _id: 1 })
      .toArray();
    return found.map(({ _id, item, status }) => ({ review: _id, item, status }));
  }

  async _forItem({
    item,
  }: {
    item: string;
  }): Promise<{ review: string; status: ReviewStatus }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.reviews.find({ item }).sort({ _id: 1 }).toArray();
    return found.map(({ _id, status }) => ({ review: _id, status }));
  }

  async _get({
    review,
  }: {
    review: string;
  }): Promise<{ item: string; status: ReviewStatus }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.reviews.findOne({ _id: review });
    return found === null ? [] : [{ item: found.item, status: found.status }];
  }

  async _getVersion({ review }: { review: string }): Promise<{ version: number }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.reviews.findOne({ _id: review }, { projection: { version: 1 } });
    return found === null ? [] : [{ version: found.version }];
  }

  async _causes({ review }: { review: string }): Promise<{ cause: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.reviews.findOne(
      { _id: review },
      { projection: { causes: 1 } },
    );
    return found === null ? [] : found.causes.toSorted().map((cause) => ({ cause }));
  }
}
