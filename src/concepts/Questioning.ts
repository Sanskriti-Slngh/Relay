import type { Collection, Db, Document, MongoClient } from "mongodb";
import { connectToDatabase, db, mongoClient } from "../db.ts";

type QuestionStatus = "OPEN" | "ANSWERED";

type QuestionDocument = Document & {
  _id: string;
  subject: string;
  text: string;
  status: QuestionStatus;
  answer?: string;
};

type QuestioningStorage = {
  db: Db;
  mongoClient: MongoClient;
  questions: Collection<QuestionDocument>;
  indexesReady?: Promise<void>;
};

export class QuestionNotFound extends Error {}
export class QuestionNotOpen extends Error {}

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
    });
    return { question };
  }

  async answer({
    question,
    answer,
  }: {
    question: string;
    answer: string;
  }): Promise<Record<string, never>> {
    await ensureStorage(this.storage);
    const result = await this.storage.questions.updateOne(
      { _id: question, status: "OPEN" },
      { $set: { status: "ANSWERED", answer } },
    );
    if (result.matchedCount === 1) return {};

    const found = await this.storage.questions.findOne(
      { _id: question },
      { projection: { _id: 1 } },
    );
    if (found === null) throw new QuestionNotFound("There is no such Question.");
    throw new QuestionNotOpen("Only an OPEN Question can be answered.");
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
  }[]> {
    await ensureConnected(this.storage);
    const found = await this.storage.questions.findOne({ _id: question });
    if (found === null) return [];
    const row = questionRow(found);
    return [{ subject: found.subject, text: row.text, status: row.status, ...("answer" in row ? { answer: row.answer } : {}) }];
  }
}
