import { describe, expect, test } from "bun:test";
import type { ClientSession, Db, MongoClient } from "mongodb";
import { runAtomically } from "../src/mongoAtomic.ts";

describe("MongoDB topology-aware atomic operations", () => {
  test("uses a real transaction when connected to a replica set", async () => {
    const calls: string[] = [];
    const session = {
      async withTransaction<T>(work: () => Promise<T>): Promise<T> {
        calls.push("transaction");
        return work();
      },
      async endSession() { calls.push("end"); },
    } as ClientSession;
    const database = { command: async () => ({ setName: "rs0" }) } as unknown as Db;
    const client = { startSession: () => session } as unknown as MongoClient;

    const result = await runAtomically(database, client, async (provided) => {
      expect(provided).toBe(session);
      return "committed";
    });

    expect(result).toBe("committed");
    expect(calls).toEqual(["transaction", "end"]);
  });

  test("serializes operations without sessions on standalone MongoDB", async () => {
    const database = { command: async () => ({ isWritablePrimary: true }) } as unknown as Db;
    const client = { startSession: () => { throw new Error("must not start a session"); } } as unknown as MongoClient;
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });

    const first = runAtomically(database, client, async (session) => {
      expect(session).toBeUndefined();
      order.push("first-start");
      markFirstStarted();
      await firstMayFinish;
      order.push("first-end");
    });
    await firstStarted;
    const second = runAtomically(database, client, async (session) => {
      expect(session).toBeUndefined();
      order.push("second");
    });
    await Promise.resolve();
    expect(order).toEqual(["first-start"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});
