import type { Collection, Db, Document, MongoClient } from "mongodb";
import { connectToDatabase, db, mongoClient } from "../db.ts";

type QuestionStatus = "OPEN" | "ANSWERED";

type QuestionDocument = Document & {
  _id: string;
  subject: string;
  text: string;
  status: QuestionStatus;
  answer?: string;
  answerer?: string;
  askedAt?: string;
  version: number;
};

type QuestioningStorage = {
  db: Db;
  mongoClient: MongoClient;
  questions: Collection<QuestionDocument>;
  indexesReady?: Promise<void>;
};

export class QuestionNotFound extends Error {}
export class QuestionNotOpen extends Error {}
export class QuestionAnswerNotEditable extends Error {}
export class VersionConflict extends Error {}

async function ensureConnected(storage: QuestioningStorage): Promise<void> {
  if (storage.db === db && storage.mongoClient === mongoClient) {
    await connectToDatabase();
  } else {
    await storage.mongoClient.connect();
    await storage.db.command({ ping: 1 });
  }
}

async function ensureStorage(storage: QuestioningStorage): Promise<void> {
  await ensureConnected(storage);
  storage.indexesReady ??= Promise.all([
    storage.questions.updateMany({ version: { $exists: false } }, { $set: { version: 1 } }),
    storage.questions.createIndex(
      { subject: 1, _id: 1 },
      { name: "questions_subject_identity" },
    ),
    storage.questions.createIndex(
      { status: 1, _id: 1 },
      { name: "questions_status_identity" },
    ),
  ]).then(() => undefined);
  await storage.indexesReady;
}

function questionRow(question: QuestionDocument) {
  return {
    question: question._id,
    text: question.text,
    status: question.status,
    ...(question.answer === undefined ? {} : { answer: question.answer }),
    ...(question.answerer === undefined ? {} : { answerer: question.answerer }),
  };
}

export class QuestioningConcept {
  private readonly storage: QuestioningStorage;

  constructor(
    database: Db = db,
    client: MongoClient = mongoClient,
    namespace = "questioning",
  ) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(namespace)) {
      throw new Error("Questioning namespace must be a stable collection prefix.");
    }
    this.storage = {
      db: database,
      mongoClient: client,
      questions: database.collection<QuestionDocument>(`${namespace}_questions`),
    };
  }

  async ask({
    subject,
    text,
  }: {
    subject: string;
    text: string;
  }): Promise<{ question: string }> {
    await ensureStorage(this.storage);
    const question = crypto.randomUUID();
    await this.storage.questions.insertOne({
      _id: question,
      subject,
      text,
      status: "OPEN",
      askedAt: new Date().toISOString(),
      version: 1,
    });
    return { question };
  }

  async answer({
    question,
    answer,
    answerer,
    expectedVersion,
  }: {
    question: string;
    answer: string;
    answerer: string;
    expectedVersion?: number;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.questions.updateOne(
      { _id: question, status: "OPEN", ...(!expectedVersion ? {} : { version: expectedVersion }) },
      { $set: { status: "ANSWERED", answer, answerer }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const found = await this.storage.questions.findOne(
      { _id: question },
      { projection: { _id: 1, status: 1, version: 1 } },
    );
    if (found === null) throw new QuestionNotFound("There is no such Question.");
    if (found.status !== "OPEN") throw new QuestionNotOpen("Only an OPEN Question can be answered.");
    throw new VersionConflict("The Question changed after it was loaded.");
  }

  async reviseAnswer({
    question,
    answer,
    answerer,
    expectedVersion,
  }: {
    question: string;
    answer: string;
    answerer: string;
    expectedVersion?: number;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.questions.updateOne(
      { _id: question, status: "ANSWERED", answerer, ...(!expectedVersion ? {} : { version: expectedVersion }) },
      { $set: { answer }, $inc: { version: 1 } },
    );
    if (result.matchedCount === 1) return {};

    const found = await this.storage.questions.findOne(
      { _id: question },
      { projection: { _id: 1, status: 1, answerer: 1, version: 1 } },
    );
    if (found === null) throw new QuestionNotFound("There is no such Question.");
    if (found.status === "ANSWERED" && found.answerer === answerer) {
      throw new VersionConflict("The Question answer changed after it was loaded.");
    }
    throw new QuestionAnswerNotEditable(
      "Only the original answerer can revise an ANSWERED Question.",
    );
  }

  async remove({
    question,
    expectedVersion,
  }: {
    question: string;
    expectedVersion?: number;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.questions.deleteOne({
      _id: question,
      ...(!expectedVersion ? {} : { version: expectedVersion }),
    });
    if (result.deletedCount === 1) return {};

    const found = await this.storage.questions.findOne(
      { _id: question },
      { projection: { _id: 1 } },
    );
    if (found === null) throw new QuestionNotFound("There is no such Question.");
    throw new VersionConflict("The Question changed after it was loaded.");
  }

  async removeForSubject({ subject }: { subject: string }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    await this.storage.questions.deleteMany({ subject });
    return {};
  }

  async _forSubject({
    subject,
  }: {
    subject: string;
  }): Promise<{
    question: string;
    text: string;
    status: QuestionStatus;
    answer?: string;
    answerer?: string;
  }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.questions.find({ subject }).sort({ _id: 1 }).toArray();
    return found.map(questionRow);
  }

  async _open(): Promise<{ question: string; subject: string; text: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.questions
      .find({ status: "OPEN" })
      .sort({ _id: 1 })
      .toArray();
    return found.map(({ _id, subject, text }) => ({ question: _id, subject, text }));
  }

  async _questions(): Promise<{
    question: string;
    subject: string;
    text: string;
    status: QuestionStatus;
    answer?: string;
    answerer?: string;
  }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.questions.find({}).sort({ _id: 1 }).toArray();
    return found.map((question) => ({ subject: question.subject, ...questionRow(question) }));
  }

  async _get({
    question,
  }: {
    question: string;
  }): Promise<{
    subject: string;
    text: string;
    status: QuestionStatus;
    answer?: string;
    answerer?: string;
  }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.questions.findOne({ _id: question });
    if (found === null) return [];
    const row = questionRow(found);
    return [{
      subject: found.subject,
      text: row.text,
      status: row.status,
      ...("answer" in row ? { answer: row.answer } : {}),
      ...("answerer" in row ? { answerer: row.answerer } : {}),
    }];
  }

  async _getVersion({ question }: { question: string }): Promise<{ version: number }[]> {
    await ensureStorage(this.storage);
    const found = await this.storage.questions.findOne({ _id: question }, { projection: { version: 1 } });
    return found === null ? [] : [{ version: found.version }];
  }

  async _getAskedAt({ question }: { question: string }): Promise<{ askedAt: string }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.questions.findOne(
      { _id: question, askedAt: { $exists: true } },
      { projection: { askedAt: 1 } },
    );
    return found?.askedAt ? [{ askedAt: found.askedAt }] : [];
  }
}
