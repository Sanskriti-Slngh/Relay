import {
  MongoServerError,
  type Collection,
  type Db,
  type Document,
  type Filter,
  type MongoClient,
} from "mongodb";
import { connectToDatabase, db, mongoClient } from "../db.ts";
import { runAtomically, type OptionalMongoSession } from "../mongoAtomic.ts";

type ContextNoteDocument = Document & {
  _id: string;
  scope: string;
  text: string;
  version: number;
};

type AttachmentDocument = Document & {
  _id: string;
  context: string;
  subject: string;
  anchor?: string;
};

type ChangeDocument = Document & {
  _id: string;
  context: string;
  before: string;
  after: string;
  occurredAt?: string;
};

type ContextTrackingStorage = {
  db: Db;
  mongoClient: MongoClient;
  contextNotes: Collection<ContextNoteDocument>;
  attachments: Collection<AttachmentDocument>;
  changes: Collection<ChangeDocument>;
  indexesReady?: Promise<void>;
};

export class ContextNotFound extends Error {}
export class AttachmentNotFound extends Error {}
export class AttachmentAlreadyExists extends Error {}
export class ChangeNotDifferent extends Error {}
export class ContextTrackingIntegrityError extends Error {}
export class VersionConflict extends Error {}

async function ensureConnected(storage: ContextTrackingStorage): Promise<void> {
  if (storage.db === db && storage.mongoClient === mongoClient) {
    await connectToDatabase();
  } else {
    await storage.mongoClient.connect();
    await storage.db.command({ ping: 1 });
  }
}

async function ensureStorage(storage: ContextTrackingStorage): Promise<void> {
  await ensureConnected(storage);
  storage.indexesReady ??= Promise.all([
    storage.contextNotes.updateMany({ version: { $exists: false } }, { $set: { version: 1 } }),
    storage.contextNotes.createIndex(
      { scope: 1, _id: 1 },
      { name: "context_scope_identity" },
    ),
    storage.attachments.createIndex(
      { context: 1, subject: 1, anchor: 1 },
      { name: "context_subject_anchor_unique", unique: true },
    ),
    storage.attachments.createIndex(
      { context: 1, _id: 1 },
      { name: "attachments_context_identity" },
    ),
    storage.attachments.createIndex(
      { anchor: 1, _id: 1 },
      { name: "attachments_anchor_identity" },
    ),
    storage.changes.createIndex(
      { context: 1, _id: 1 },
      { name: "changes_context_identity" },
    ),
  ]).then(() => undefined);
  await storage.indexesReady;
}

async function inTransaction<T>(
  storage: ContextTrackingStorage,
  work: (session: OptionalMongoSession) => Promise<T>,
): Promise<T> {
  await ensureStorage(storage);
  return runAtomically(storage.db, storage.mongoClient, work);
}

function isAttachmentUniquenessViolation(error: unknown): boolean {
  if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
  const keyPattern = error.keyPattern;
  return keyPattern?.context === 1 && keyPattern.subject === 1 && keyPattern.anchor === 1;
}

function attachmentFilter(attachment: string): Filter<AttachmentDocument> {
  return { _id: attachment };
}

export class ContextTrackingConcept {
  private readonly storage: ContextTrackingStorage;

  constructor(database: Db = db, client: MongoClient = mongoClient) {
    this.storage = {
      db: database,
      mongoClient: client,
      contextNotes: database.collection<ContextNoteDocument>("contextTracking_contextNotes"),
      attachments: database.collection<AttachmentDocument>("contextTracking_attachments"),
      changes: database.collection<ChangeDocument>("contextTracking_changes"),
    };
  }

  async record({
    scope,
    text,
  }: {
    scope: string;
    text: string;
  }): Promise<{ context: string }> {
    await ensureStorage(this.storage);
    const context = crypto.randomUUID();
    await this.storage.contextNotes.insertOne({ _id: context, scope, text, version: 1 });
    return { context };
  }

  async attach({
    context,
    subject,
  }: {
    context: string;
    subject: string;
  }): Promise<{ attachment: string }> {
    await ensureStorage(this.storage);
    if (!(await this.storage.contextNotes.findOne({ _id: context }, { projection: { _id: 1 } }))) {
      throw new ContextNotFound("There is no such ContextNote.");
    }

    const attachment = crypto.randomUUID();
    try {
      await this.storage.attachments.insertOne({ _id: attachment, context, subject });
    } catch (error) {
      if (isAttachmentUniquenessViolation(error)) {
        throw new AttachmentAlreadyExists(
          "That ContextNote is already attached to the subject without an anchor.",
        );
      }
      throw error;
    }
    return { attachment };
  }

  async attachAt({
    context,
    subject,
    anchor,
  }: {
    context: string;
    subject: string;
    anchor: string;
  }): Promise<{ attachment: string }> {
    await ensureStorage(this.storage);
    if (!(await this.storage.contextNotes.findOne({ _id: context }, { projection: { _id: 1 } }))) {
      throw new ContextNotFound("There is no such ContextNote.");
    }

    const attachment = crypto.randomUUID();
    try {
      await this.storage.attachments.insertOne({ _id: attachment, context, subject, anchor });
    } catch (error) {
      if (isAttachmentUniquenessViolation(error)) {
        throw new AttachmentAlreadyExists(
          "That ContextNote is already attached to the subject at that anchor.",
        );
      }
      throw error;
    }
    return { attachment };
  }

  async detach({ attachment }: { attachment: string }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.attachments.deleteOne(attachmentFilter(attachment));
    if (result.deletedCount !== 1) {
      throw new AttachmentNotFound("There is no such Attachment.");
    }
    return {};
  }

  async remove({
    context,
    expectedVersion,
  }: {
    context: string;
    expectedVersion?: number;
  }): Promise<Record<string, never>> {
    return inTransaction(this.storage, async (session) => {
      const result = await this.storage.contextNotes.deleteOne(
        { _id: context, ...(!expectedVersion ? {} : { version: expectedVersion }) },
        { session },
      );
      if (result.deletedCount !== 1) {
        const found = await this.storage.contextNotes.findOne(
          { _id: context },
          { session, projection: { _id: 1 } },
        );
        if (found === null) throw new ContextNotFound("There is no such ContextNote.");
        throw new VersionConflict(`ContextNote ${context} changed before it was removed.`);
      }
      await this.storage.attachments.deleteMany({ context }, { session });
      return {};
    });
  }

  async correct({
    context,
    text,
    expectedVersion,
  }: {
    context: string;
    text: string;
    expectedVersion?: number;
  }): Promise<Record<string, never>> {
    return inTransaction(this.storage, async (session) => {
      const current = await this.storage.contextNotes.findOne({ _id: context }, { session });
      if (current === null) throw new ContextNotFound("There is no such ContextNote.");

      const result = await this.storage.contextNotes.updateOne(
        { _id: context, text: current.text, ...(!expectedVersion ? {} : { version: expectedVersion }) },
        { $set: { text }, $inc: { version: 1 } },
        { session },
      );
      if (result.matchedCount !== 1) {
        throw new VersionConflict(`ContextNote ${context} changed during its correction.`);
      }
      return {};
    });
  }

  async change({
    context,
    text,
    expectedVersion,
  }: {
    context: string;
    text: string;
    expectedVersion?: number;
  }): Promise<{ change: string }> {
    return inTransaction(this.storage, async (session) => {
      const current = await this.storage.contextNotes.findOne({ _id: context }, { session });
      if (current === null) throw new ContextNotFound("There is no such ContextNote.");
      if (text === current.text) {
        throw new ChangeNotDifferent("The new text must differ from the current text.");
      }

      const result = await this.storage.contextNotes.updateOne(
        { _id: context, text: current.text, ...(!expectedVersion ? {} : { version: expectedVersion }) },
        { $set: { text }, $inc: { version: 1 } },
        { session },
      );
      if (result.matchedCount !== 1) {
        throw new VersionConflict(`ContextNote ${context} changed while recording its Change.`);
      }

      const change = crypto.randomUUID();
      await this.storage.changes.insertOne(
        { _id: change, context, before: current.text, after: text, occurredAt: new Date().toISOString() },
        { session },
      );
      return { change };
    });
  }

  async _notes({ scope }: { scope: string }): Promise<{ context: string; text: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.contextNotes.find({ scope }).sort({ _id: 1 }).toArray();
    return found.map(({ _id, text }) => ({ context: _id, text }));
  }

  async _get({
    context,
  }: {
    context: string;
  }): Promise<{ scope: string; text: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.contextNotes.findOne({ _id: context });
    return found === null ? [] : [{ scope: found.scope, text: found.text }];
  }

  async _getVersion({ context }: { context: string }): Promise<{ version: number }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.contextNotes.findOne({ _id: context }, { projection: { version: 1 } });
    return found === null ? [] : [{ version: found.version }];
  }

  async _attachments({
    context,
  }: {
    context: string;
  }): Promise<{ attachment: string; subject: string; anchor?: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.attachments.find({ context }).sort({ _id: 1 }).toArray();
    return found.map(({ _id, subject, anchor }) => ({
      attachment: _id,
      subject,
      ...(anchor === undefined ? {} : { anchor }),
    }));
  }

  async _getAttachment({
    attachment,
  }: {
    attachment: string;
  }): Promise<{ context: string; subject: string; anchor?: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.attachments.findOne(attachmentFilter(attachment));
    return found === null
      ? []
      : [
          {
            context: found.context,
            subject: found.subject,
            ...(found.anchor === undefined ? {} : { anchor: found.anchor }),
          },
        ];
  }

  async _atAnchor({
    anchor,
  }: {
    anchor: string;
  }): Promise<{ attachment: string; context: string; subject: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.attachments.find({ anchor }).sort({ _id: 1 }).toArray();
    return found.map(({ _id, context, subject }) => ({ attachment: _id, context, subject }));
  }

  async _changes({
    context,
  }: {
    context: string;
  }): Promise<{ change: string; before: string; after: string; occurredAt?: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.changes.find({ context }).sort({ _id: 1 }).toArray();
    return found.map(({ _id, before, after, occurredAt }) => ({
      change: _id,
      before,
      after,
      ...(occurredAt === undefined ? {} : { occurredAt }),
    }));
  }

  async _getChange({
    change,
  }: {
    change: string;
  }): Promise<{ context: string; before: string; after: string; occurredAt?: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.changes.findOne({ _id: change });
    return found === null
      ? []
      : [{
          context: found.context,
          before: found.before,
          after: found.after,
          ...(found.occurredAt === undefined ? {} : { occurredAt: found.occurredAt }),
        }];
  }
}
