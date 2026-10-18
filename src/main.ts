import { validateDeploymentHostConfig } from "./host/config.ts";

const distributionDirectory = `${import.meta.dir}/../dist`;

export function isHostRoute(pathname: string): boolean {
  return pathname === "/session" || pathname.startsWith("/session/") ||
    pathname.startsWith("/auth/") || pathname === "/workspaces" || pathname.startsWith("/workspaces/") ||
    pathname.startsWith("/invitations/") || pathname.startsWith("/api/");
}

if (import.meta.main) {
  let client: import("mongodb").MongoClient | undefined;
  let startupStage = "configuration validation";
  try {
    const config = validateDeploymentHostConfig(process.env);
    const rawPort = process.env.PORT ?? "3000";
    const port = Number(rawPort);
    const hostname = process.env.HOST?.trim() || "0.0.0.0";
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("PORT must be an integer between 1 and 65535.");
    }

    const [database, assembly, { provisionApplicationRoles }, { AccountStore }, { createMultiUserRelayHttpHandler }] = await Promise.all([
      import("./db.ts"),
      import("./assembly.ts"),
      import("./host/provision.ts"),
      import("./host/accounts.ts"),
      import("./host/multiUserHttp.ts"),
    ]);
    client = database.mongoClient;
    startupStage = "MongoDB connection";
    await database.connectToDatabase();

    startupStage = "application assembly";
    const { application, roleAccess } = assembly.createApplication(database.db, database.mongoClient);
    startupStage = "application Role provisioning";
    const roles = await provisionApplicationRoles(roleAccess);
    const accounts = new AccountStore(database.db, roleAccess);
    startupStage = "HTTP handler construction";
    const handler = createMultiUserRelayHttpHandler(application, accounts, config, roles);
    startupStage = "HTTP listener startup";
    const server = Bun.serve({
      hostname,
      port,
      async fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/health") {
          if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
          }
          try {
            await database.db.command({ ping: 1 });
            return new Response(request.method === "HEAD" ? null : JSON.stringify({ status: "ok" }), {
              status: 200,
              headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
            });
          } catch {
            return new Response(request.method === "HEAD" ? null : JSON.stringify({ status: "unavailable" }), {
              status: 503,
              headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
            });
          }
        }
        if (isHostRoute(pathname)) {
          return handler(request);
        }
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        const assetPath = pathname === "/" ? "index.html" : pathname.slice(1);
        if (!/^[A-Za-z0-9._/-]+$/.test(assetPath) || assetPath.includes("..")) return new Response("Not found", { status: 404 });
        const asset = Bun.file(`${distributionDirectory}/${assetPath}`);
        return await asset.exists() ? new Response(asset) : new Response(Bun.file(`${distributionDirectory}/index.html`));
      },
    });
    console.info(`Relay listening on port ${server.port}.`);
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
