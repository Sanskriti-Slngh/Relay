import type { ClientSession, Db, MongoClient } from "mongodb";

export type OptionalMongoSession = ClientSession | undefined;

const transactionSupport = new WeakMap<MongoClient, Promise<boolean>>();
const standaloneTails = new WeakMap<MongoClient, Promise<unknown>>();

async function supportsTransactions(database: Db, client: MongoClient): Promise<boolean> {
  let known = transactionSupport.get(client);
  if (!known) {
    known = database.command({ hello: 1 }).then(
      (hello) => typeof hello.setName === "string" || hello.msg === "isdbgrid",
    );
    transactionSupport.set(client, known);
  }
  return known;
}

async function serializeForStandalone<T>(client: MongoClient, work: () => Promise<T>): Promise<T> {
  const previous = standaloneTails.get(client) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  standaloneTails.set(client, current);
  try {
    return await current;
  } finally {
    if (standaloneTails.get(client) === current) standaloneTails.delete(client);
  }
}

/**
 * Uses a MongoDB transaction when the server supports one. The 6.1040 Apps
 * MongoDB is standalone, so those deployments instead serialize guarded
 * multi-operation concept actions within the single application process.
 */
export async function runAtomically<T>(
  database: Db,
  client: MongoClient,
  work: (session: OptionalMongoSession) => Promise<T>,
): Promise<T> {
  if (!(await supportsTransactions(database, client))) {
    return serializeForStandalone(client, () => work(undefined));
  }

  const session = client.startSession();
  try {
    const result = await session.withTransaction(async () => ({ value: await work(session) }));
    if (result === undefined) throw new Error("MongoDB transaction completed without a result.");
    return result.value;
  } finally {
    await session.endSession();
  }
}
