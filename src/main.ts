import { validateHostConfig } from "./host/config.ts";

if (import.meta.main) {
  let client: import("mongodb").MongoClient | undefined;
  let startupStage = "configuration validation";
  try {
    const config = validateHostConfig(process.env);
    const rawPort = process.env.PORT ?? "3000";
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("PORT must be an integer between 1 and 65535.");
    }

    const [database, assembly, { provisionOfficer }, { createRelayHttpHandler }] = await Promise.all([
      import("./db.ts"),
      import("./assembly.ts"),
      import("./host/provision.ts"),
      import("./host/http.ts"),
    ]);
    client = database.mongoClient;
    startupStage = "MongoDB connection";
    await database.connectToDatabase();

    startupStage = "application assembly";
    const { application, roleAccess } = assembly.createApplication(database.db, database.mongoClient);
    startupStage = "private Officer provisioning";
    await provisionOfficer(config, roleAccess);
    startupStage = "HTTP handler construction";
    const handler = createRelayHttpHandler(application, config);
    startupStage = "HTTP listener startup";
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      fetch: handler,
    });
    console.info(`Relay API listening at http://127.0.0.1:${server.port}/api`);
  } catch (error) {
    const errorKind = error instanceof Error ? error.name : "UnknownError";
    console.error(`Relay host startup failed during ${startupStage} (${errorKind}).`);
    if (client) {
      await client.close().catch(() => {
        console.error("Relay MongoDB client cleanup failed.");
      });
    }
    process.exitCode = 1;
  }
}
