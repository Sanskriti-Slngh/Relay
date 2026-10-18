import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { createApplication } from "../../src/assembly.ts";
import { AccountStore } from "../../src/host/accounts.ts";
import type { DeploymentHostConfig } from "../../src/host/config.ts";
import { createMultiUserRelayHttpHandler } from "../../src/host/multiUserHttp.ts";
import { provisionApplicationRoles } from "../../src/host/provision.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) throw new Error("MONGODB_URL is required.");
const client = new MongoClient(configuredUrl);
const databaseName = `relay_multi_user_${crypto.randomUUID().replaceAll("-", "")}`;
const database = client.db(databaseName);
const origin = "http://127.0.0.1:5173";
const config: DeploymentHostConfig = { mongodbUrl: configuredUrl, appOrigin: origin, secureCookies: false };

type Browser = { cookie: string; csrf: string };
let handler: (request: Request) => Promise<Response>;
let application: ReturnType<typeof createApplication>["application"];

async function call(path: string, body?: Record<string, unknown>, browser?: Browser) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (browser) { headers.set("cookie", browser.cookie); headers.set("x-relay-csrf", browser.csrf); }
  const result = await handler(new Request(`http://127.0.0.1${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: result.status, headers: result.headers, body: await result.json() as Record<string, any> };
}

async function register(email: string): Promise<Browser> {
  const result = await call("/auth/register", { email, password: "a secure password", name: email.split("@")[0] });
  expect(result.status).toBe(200);
  return { cookie: result.headers.get("set-cookie")!.split(";")[0], csrf: result.body.csrfToken };
}

describe("multi-user Relay host", () => {
  beforeAll(async () => {
    await client.connect();
    ({ application } = createApplication(database, client));
    const { roleAccess } = createApplication(database, client);
    const roles = await provisionApplicationRoles(roleAccess);
    handler = createMultiUserRelayHttpHandler(application, new AccountStore(database, roleAccess), config, roles);
  });

  afterAll(async () => {
    try { if (application) await application.whenIdle(); await database.dropDatabase(); }
    finally { await client.close(); }
  });

  test("registers distinct users, creates isolated clubs, and never trusts forged identities", async () => {
    const officer = await register("officer@example.org");
    const firstClub = await call("/workspaces/create", { name: "First Club" }, officer);
    expect(firstClub.status).toBe(200);
    const firstWorkspace = firstClub.body.workspace as string;
    const procedure = await call("/api/workspaces/procedures/create", { title: "Private plan", user: "forged", workspace: "forged" }, officer);
    expect(procedure.status).toBe(200);

    const outsider = await register("outsider@example.org");
    const secondClub = await call("/workspaces/create", { name: "Second Club" }, outsider);
    expect(secondClub.status).toBe(200);
    expect(secondClub.body.workspace).not.toBe(firstWorkspace);
    const outsiderRead = await call("/api/workspaces/procedures", { workspace: firstWorkspace, user: firstClub.body.user?.id }, outsider);
    expect(outsiderRead.status).toBe(200);
    expect(outsiderRead.body.procedures).toEqual([]);
    const selectForeign = await call("/workspaces/select", { workspace: firstWorkspace }, outsider);
    expect(selectForeign).toEqual(expect.objectContaining({ status: 404 }));
  });

  test("supports one-time member invitations and enforces Member and Officer permissions", async () => {
    const officer = await register("leader@example.org");
    const club = await call("/workspaces/create", { name: "Robotics" }, officer);
    const procedure = await call("/api/workspaces/procedures/create", { title: "Competition setup" }, officer);
    const step = await call("/api/workspaces/procedures/steps/add", { procedure: procedure.body.procedure, text: "Charge batteries" }, officer);
    const invitation = await call("/invitations/create", { email: "member@example.org", role: "Officer" }, officer);
    expect(invitation.status).toBe(200);

    const member = await register("member@example.org");
    const accepted = await call("/invitations/accept", { token: invitation.body.token, role: "Officer" }, member);
    expect(accepted.status).toBe(200);
    expect(accepted.body.role).toBe("Member");
    expect(accepted.body.workspace).toBe(club.body.workspace);
    const reused = await call("/invitations/accept", { token: invitation.body.token }, member);
    expect(reused.status).toBe(404);

    const read = await call("/api/workspaces/procedures", {}, member);
    expect(read.status).toBe(200);
    expect(read.body.procedures[0].title).toBe("Competition setup");
    const forbiddenEdit = await call("/api/workspaces/procedures/rename", { procedure: procedure.body.procedure, title: "Forged edit", user: accepted.body.user?.id }, member);
    expect(forbiddenEdit.status).toBe(403);
    const question = await call("/api/workspaces/questions/steps/ask", { procedure: procedure.body.procedure, step: step.body.step, text: "Which charger?" }, member);
    expect(question.status).toBe(200);
    const forbiddenAnswer = await call("/api/workspaces/questions/steps/answer", { question: question.body.question, answer: "Mine" }, member);
    expect(forbiddenAnswer.status).toBe(403);
    const officerAnswer = await call("/api/workspaces/questions/steps/answer", { question: question.body.question, answer: "Use the labeled charger." }, officer);
    expect(officerAnswer.status).toBe(200);
  });

  test("persists sessions across handler instances and expires them server-side", async () => {
    let now = new Date("2026-10-17T12:00:00Z");
    const { application: secondApplication, roleAccess } = createApplication(database, client);
    const roles = await provisionApplicationRoles(roleAccess);
    const store = new AccountStore(database, roleAccess, () => now);
    const firstHandler = createMultiUserRelayHttpHandler(secondApplication, store, config, roles);
    handler = firstHandler;
    const browser = await register("persistent@example.org");
    const freshHandler = createMultiUserRelayHttpHandler(secondApplication, new AccountStore(database, roleAccess, () => now), config, roles);
    handler = freshHandler;
    expect((await call("/session", undefined, browser)).body.authenticated).toBe(true);
    now = new Date(now.getTime() + 8 * 60 * 60 * 1_000 + 1);
    expect((await call("/session", undefined, browser)).body).toEqual({ authenticated: false });
  });

  test("rejects wrong credentials, foreign invitation emails, missing CSRF, and cross-origin requests", async () => {
    const officer = await register("security@example.org");
    await call("/workspaces/create", { name: "Security Club" }, officer);
    const invite = await call("/invitations/create", { email: "intended@example.org" }, officer);
    const wrong = await register("wrong@example.org");
    expect((await call("/invitations/accept", { token: invite.body.token }, wrong)).status).toBe(404);
    expect((await call("/auth/login", { email: "security@example.org", password: "wrong password" })).status).toBe(401);
    const noCsrf = await handler(new Request("http://127.0.0.1/api/workspaces/procedures", { method: "POST", headers: { origin, cookie: officer.cookie, "content-type": "application/json" }, body: "{}" }));
    expect(noCsrf.status).toBe(403);
    const crossOrigin = await handler(new Request("http://127.0.0.1/session", { headers: { origin: "https://attacker.example", cookie: officer.cookie } }));
    expect(crossOrigin.status).toBe(403);
  });
});
