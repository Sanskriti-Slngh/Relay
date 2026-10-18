const commands = [
  ["bun", "run", "start"],
  ["bunx", "vite", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
] as const;

const childEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
childEnvironment.PUBLIC_ORIGIN ??= "http://127.0.0.1:5173";
const demoDatabase = process.env.RELAY_DEMO_DATABASE?.trim();
if (demoDatabase) {
  if (
    demoDatabase.length > 63 ||
    !/^[A-Za-z0-9_-]+$/.test(demoDatabase) ||
    demoDatabase === "admin" ||
    demoDatabase === "local" ||
    demoDatabase === "config"
  ) {
    throw new Error("RELAY_DEMO_DATABASE must be a safe MongoDB database name of at most 63 characters.");
  }
  const configuredUrl = process.env.MONGODB_URL;
  if (!configuredUrl) throw new Error("MONGODB_URL is required when selecting a demo database.");
  const mongoUrl = new URL(configuredUrl);
  const configuredDatabase = decodeURIComponent(mongoUrl.pathname.slice(1));
  if (configuredDatabase === demoDatabase) {
    throw new Error("RELAY_DEMO_DATABASE must differ from the configured application database.");
  }
  mongoUrl.pathname = `/${encodeURIComponent(demoDatabase)}`;
  childEnvironment.MONGODB_URL = mongoUrl.toString();
}

const frontendEnvironment = Object.fromEntries(
  Object.entries(childEnvironment).filter(
    ([name]) =>
      ![
        "CLUB_WORKSPACE_ID",
        "OFFICER_USER_ID",
        "LOCAL_ACCESS_CREDENTIAL",
        "MONGODB_URL",
        "RELAY_DEMO_DATABASE",
      ].includes(name),
  ),
);

const children = [
  Bun.spawn([...commands[0]], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: childEnvironment,
  }),
  Bun.spawn([...commands[1]], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: frontendEnvironment,
  }),
];

let stopping = false;
function stopChildren() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}

process.on("SIGINT", stopChildren);
process.on("SIGTERM", stopChildren);

const firstExit = await Promise.race(
  children.map(async (child, index) => ({
    index,
    code: await child.exited,
  })),
);
stopChildren();
await Promise.all(children.map((child) => child.exited));
process.exitCode = firstExit.code;
