import { MongoClient, type Db } from "mongodb";

const mongodbUrl = process.env.MONGODB_URL;

if (!mongodbUrl) {
  throw new Error("MONGODB_URL is required. Copy .env.example to .env and configure it.");
}

export const mongoClient = new MongoClient(mongodbUrl);
export const db = mongoClient.db();

export async function connectToDatabase(): Promise<Db> {
  await mongoClient.connect();
  await db.command({ ping: 1 });
  return db;
}

if (import.meta.main) {
  try {
    const connectedDb = await connectToDatabase();
    console.info(`MongoDB connection successful: ${connectedDb.databaseName}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoClient.close();
  }
}
