import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { db } from "../../src/db.ts";
import { createApplication } from "../../src/assembly.ts";
import type { HostConfig } from "../../src/host/config.ts";
import { createRelayHttpHandler } from "../../src/host/http.ts";
import { provisionOfficer } from "../../src/host/provision.ts";

const configuredUrl = process.env.MONGODB_URL;
if (!configuredUrl) {
  throw new Error("MONGODB_URL must point to the Relay MongoDB replica set to run this suite.");
}

const testClient = new MongoClient(configuredUrl);
const applicationDatabaseName = db.databaseName;
const testDatabaseName = `relay_backend_tests_${crypto.randomUUID().replaceAll("-", "")}`;
if (testDatabaseName === applicationDatabaseName) {
  throw new Error("The backend test database must be isolated from application data.");
}

const testDb = testClient.db(testDatabaseName);
const hostConfig: HostConfig = Object.freeze({
  clubWorkspaceId: `relay-workspace-${crypto.randomUUID()}`,
  officerUserId: `relay-officer-${crypto.randomUUID()}`,
  localAccessCredential: Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString("base64url"),
  mongodbUrl: configuredUrl,
});

let application: ReturnType<typeof createApplication>["application"];
let roleAccess: ReturnType<typeof createApplication>["roleAccess"];
let handler: ReturnType<typeof createRelayHttpHandler>;
let sessionCookie = "";
let csrfToken = "";
const frontendOrigin = "http://127.0.0.1:5173";

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} was not returned as a string.`);
  return value;
}

async function request(
  path: string,
  body: Record<string, unknown>,
  credential?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers({
    origin: frontendOrigin,
    "content-type": "application/json",
  });
  if (credential === undefined && sessionCookie) {
    headers.set("cookie", sessionCookie);
    headers.set("x-relay-csrf", csrfToken);
  } else if (credential !== undefined) {
    headers.set("authorization", `Bearer ${credential}`);
  }
  const response = await handler(
    new Request(`http://127.0.0.1/api${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

async function createProcedure(title: string): Promise<string> {
  const response = await request("/workspaces/procedures/create", { title });
  expect(response.status).toBe(200);
  expect(typeof response.body.procedure).toBe("string");
  return response.body.procedure as string;
}

describe("Relay trusted HTTP backend", () => {
  beforeAll(async () => {
    await testClient.connect();
    await testDb.command({ ping: 1 });
    ({ application, roleAccess } = createApplication(testDb, testClient));
    await provisionOfficer(hostConfig, roleAccess);
    handler = createRelayHttpHandler(application, hostConfig);
    const login = await handler(new Request("http://127.0.0.1/session", {
      method: "POST",
      headers: {
        origin: frontendOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ credential: hostConfig.localAccessCredential }),
    }));
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("SameSite=Strict");
    sessionCookie = login.headers.get("set-cookie")!.split(";")[0];
    csrfToken = (await login.json() as { csrfToken: string }).csrfToken;
    const publicRoutes = Object.keys(application.publicInterface.routes);
    expect(publicRoutes.some((route) => /role|permission|assignment/i.test(route))).toBe(false);
  });

  afterAll(async () => {
    try {
      if (application) await application.whenIdle();
      await testClient.db(testDatabaseName).dropDatabase();
      const remaining = await testClient.db("admin").command({
        listDatabases: 1,
        nameOnly: true,
        filter: { name: testDatabaseName },
      });
      expect(remaining.databases).toEqual([]);
    } finally {
      await testClient.close();
    }
  });

  test("uses an isolated database and rejects missing or invalid local credentials", async () => {
    expect(testDatabaseName).not.toBe(applicationDatabaseName);
    expect(testDatabaseName).toMatch(/^relay_backend_tests_[a-f0-9]+$/);

    const missing = await handler(new Request("http://127.0.0.1/api/workspaces/procedures", {
      method: "POST",
      headers: {
        origin: frontendOrigin,
        "content-type": "application/json",
      },
      body: "{}",
    }));
    const invalid = await handler(new Request("http://127.0.0.1/session", {
      method: "POST",
      headers: {
        origin: frontendOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ credential: "invalid-token" }),
    }));
    const crossSiteLogin = await handler(new Request("http://127.0.0.1/session", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ credential: hostConfig.localAccessCredential }),
    }));
    const bearerOnly = await request("/workspaces/procedures", {}, "invalid-token");
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(invalid.status).toBe(401);
    expect(crossSiteLogin.status).toBe(403);
    expect(await crossSiteLogin.json()).toEqual({ error: "ORIGIN_REJECTED" });
    expect(bearerOnly.status).toBe(401);

    const oversized = await request("/workspaces/procedures/create", {
      title: "x".repeat(66_000),
    });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error).toBe("INVALID_INPUT");
  });

  test("requires a same-origin request and CSRF token for authenticated mutations", async () => {
    const noCsrf = await handler(new Request("http://127.0.0.1/api/workspaces/procedures", {
      method: "POST",
      headers: {
        origin: frontendOrigin,
        cookie: sessionCookie,
        "content-type": "application/json",
      },
      body: "{}",
    }));
    const crossSite = await handler(new Request("http://127.0.0.1/api/workspaces/procedures", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        cookie: sessionCookie,
        "x-relay-csrf": csrfToken,
        "content-type": "application/json",
      },
      body: "{}",
    }));
    expect(noCsrf.status).toBe(403);
    expect(await noCsrf.json()).toEqual({ error: "CSRF_REJECTED" });
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toEqual({ error: "ORIGIN_REJECTED" });
  });

  test("returns only session state and revokes a logged-out browser session", async () => {
    const status = await handler(new Request("http://127.0.0.1/session"));
    expect(await status.json()).toEqual({ authenticated: false });

    const logout = await handler(new Request("http://127.0.0.1/session/logout", {
      method: "POST",
      headers: {
        origin: frontendOrigin,
        cookie: sessionCookie,
        "x-relay-csrf": csrfToken,
      },
    }));
    expect(logout.status).toBe(200);
    const afterLogout = await handler(new Request("http://127.0.0.1/session", {
      headers: { cookie: sessionCookie },
    }));
    expect(await afterLogout.json()).toEqual({ authenticated: false });
    const renewed = await handler(new Request("http://127.0.0.1/session", {
      method: "POST",
      headers: {
        origin: frontendOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ credential: hostConfig.localAccessCredential }),
    }));
    expect(renewed.status).toBe(200);
    sessionCookie = renewed.headers.get("set-cookie")!.split(";")[0];
    csrfToken = (await renewed.json() as { csrfToken: string }).csrfToken;
  });

  test("expires a browser session after its configured lifetime", async () => {
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      const expiringHandler = createRelayHttpHandler(application, hostConfig);
      const login = await expiringHandler(new Request("http://127.0.0.1/session", {
        method: "POST",
        headers: { origin: frontendOrigin, "content-type": "application/json" },
        body: JSON.stringify({ credential: hostConfig.localAccessCredential }),
      }));
      const cookie = login.headers.get("set-cookie")!.split(";")[0];
      const token = (await login.json() as { csrfToken: string }).csrfToken;
      now += 8 * 60 * 60 * 1_000 + 1;

      const status = await expiringHandler(new Request("http://127.0.0.1/session", {
        headers: { cookie },
      }));
      expect(await status.json()).toEqual({ authenticated: false });
      const protectedRequest = await expiringHandler(new Request(
        "http://127.0.0.1/api/workspaces/procedures",
        {
          method: "POST",
          headers: {
            origin: frontendOrigin,
            cookie,
            "x-relay-csrf": token,
            "content-type": "application/json",
          },
          body: "{}",
        },
      ));
      expect(protectedRequest.status).toBe(401);
      expect(await protectedRequest.json()).toEqual({ error: "UNAUTHORIZED" });
    } finally {
      Date.now = realNow;
    }
  });

  test("overwrites forged User and workspace input with server-controlled identities", async () => {
    const response = await request("/workspaces/procedures/create", {
      title: "Trusted host injection",
      user: "forged-user",
      workspace: "forged-workspace",
    });
    expect(response.status).toBe(200);

    const procedure = response.body.procedure as string;
    expect(await application.concepts.ProcedureMaintaining._get({ procedure })).toEqual([
      {
        space: hostConfig.clubWorkspaceId,
        title: "Trusted host injection",
        status: "ACTIVE",
      },
    ]);
    expect(await roleAccess._assignmentsFor({
      user: "forged-user",
      resource: "forged-workspace",
    })).toEqual([]);
  });

  test("denies mutations after permission removal and leaves procedure state unchanged", async () => {
    const procedure = await createProcedure("Archive permission check");
    const officerRole = (await roleAccess._roles()).find(({ name }) => name === "Officer")!.role;
    await roleAccess.revokePermission({ role: officerRole, permission: "EDIT_PROCEDURE" });
    const response = await request("/workspaces/procedures/create", { title: "Denied create" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("FORBIDDEN");
    const deniedRead = await request("/workspaces/procedures", {});
    expect(deniedRead.status).toBe(403);
    const deniedArchive = await request("/workspaces/procedures/archive", { procedure });
    expect(deniedArchive.status).toBe(403);
    expect(await application.concepts.ProcedureMaintaining._get({ procedure })).toEqual([
      {
        space: hostConfig.clubWorkspaceId,
        title: "Archive permission check",
        status: "ACTIVE",
      },
    ]);
    await roleAccess.revokePermission({ role: officerRole, permission: "COMPLETE_REVIEW" });
    const deniedHistory = await request("/workspaces/reviews", {});
    expect(deniedHistory.status).toBe(403);
    await roleAccess.permit({ role: officerRole, permission: "COMPLETE_REVIEW" });
    await roleAccess.permit({ role: officerRole, permission: "EDIT_PROCEDURE" });

    const listed = await application.concepts.ProcedureMaintaining._procedures({
      space: hostConfig.clubWorkspaceId,
    });
    expect(listed.some(({ title }) => title === "Denied create")).toBe(false);
  });

  test("archives only an active in-workspace Playbook and retains its Steps, attachments, and Reviews", async () => {
    const procedure = await createProcedure("Archive keeps history");
    const stepResponse = await request("/workspaces/procedures/steps/add", {
      procedure,
      text: "Keep the ordered Step",
    });
    expect(stepResponse.status).toBe(200);

    const noteResponse = await request("/workspaces/context/notes", {
      text: "Context retained after archiving",
    });
    const context = requireString(noteResponse.body.context, "ContextNote");
    expect((await request("/workspaces/context/attachments", { context, procedure })).status).toBe(200);
    const changeResponse = await request("/workspaces/context/change", {
      context,
      text: "Meaningful update before archival",
    });
    expect(changeResponse.status).toBe(200);
    const beforeArchive = await request("/workspaces/reviews/pending", {});
    expect(beforeArchive.body.reviews).toHaveLength(1);

    const archived = await request("/workspaces/procedures/archive", { procedure });
    expect(archived).toEqual({
      status: 200,
      body: { procedure, status: "RETIRED" },
    });
    expect(await application.concepts.ProcedureMaintaining._get({ procedure })).toEqual([
      {
        space: hostConfig.clubWorkspaceId,
        title: "Archive keeps history",
        status: "RETIRED",
      },
    ]);
    expect(await application.concepts.ProcedureMaintaining._steps({ procedure })).toHaveLength(1);
    expect(await application.concepts.ContextTracking._attachments({ context })).toHaveLength(1);
    expect((await request("/workspaces/procedures", {})).body.procedures).toContainEqual(
      expect.objectContaining({ procedure, status: "RETIRED" }),
    );
    expect((await request("/workspaces/reviews/pending", {})).body.reviews).toContainEqual(
      expect.objectContaining({ procedure, title: "Archive keeps history" }),
    );
    expect((await request("/workspaces/reviews", {})).body.procedures).toContainEqual(
      expect.objectContaining({
        procedure,
        reviews: [expect.objectContaining({ status: "PENDING" })],
      }),
    );
    expect((await request("/workspaces/procedures/steps/add", {
      procedure,
      text: "Cannot add a Step after archiving",
    })).status).toBe(404);
    expect((await request("/workspaces/procedures/archive", { procedure })).status).toBe(404);

    const retainedReview = (beforeArchive.body.reviews as { review: string }[])[0]?.review;
    if (!retainedReview) throw new Error("Expected the archived Playbook's Review to remain available.");
    expect((await request("/workspaces/reviews/confirm", {
      review: retainedReview,
      procedure,
    })).status).toBe(200);

    const foreign = await application.concepts.ProcedureMaintaining.create({
      space: "foreign-workspace",
      title: "Foreign active Playbook",
    });
    const foreignProcedure = requireString(foreign.procedure, "Foreign Procedure");
    expect((await request("/workspaces/procedures/archive", {
      procedure: foreignProcedure,
    })).status).toBe(404);
    expect(await application.concepts.ProcedureMaintaining._get({
      procedure: foreignProcedure,
    })).toEqual([
      {
        space: "foreign-workspace",
        title: "Foreign active Playbook",
        status: "ACTIVE",
      },
    ]);
  });

  test("does not let the configured officer mutate a Procedure from another workspace", async () => {
    const foreign = await application.concepts.ProcedureMaintaining.create({
      space: "foreign-workspace",
      title: "Foreign procedure",
    });
    const foreignProcedure = requireString(foreign.procedure, "Foreign Procedure");
    const response = await request("/workspaces/procedures/steps/add", {
      procedure: foreignProcedure,
      text: "Must not be added",
      workspace: "foreign-workspace",
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    expect(await application.concepts.ProcedureMaintaining._steps({
      procedure: foreignProcedure,
    })).toEqual([]);

    const foreignContext = await application.concepts.ContextTracking.record({
      scope: "foreign-workspace",
      text: "Private foreign context",
    });
    const foreignContextId = requireString(foreignContext.context, "Foreign ContextNote");
    const foreignAttachment = await request("/workspaces/context/attachments", {
      context: foreignContextId,
      procedure: foreignProcedure,
    });
    expect(foreignAttachment.status).toBe(404);
    expect(await application.concepts.ContextTracking._attachments({
      context: foreignContextId,
    })).toEqual([]);
  });

  test("rejects object-shaped identities before they reach MongoDB queries", async () => {
    const malformed = await request("/workspaces/procedures/steps/add", {
      procedure: { $ne: null },
      text: "Must not query with an operator object",
    });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe("INVALID_REQUEST");
  });

  test("rejects blank user-authored text at the server boundary", async () => {
    const proceduresBefore = await application.concepts.ProcedureMaintaining._procedures({
      space: hostConfig.clubWorkspaceId,
    });
    const blankTitle = await request("/workspaces/procedures/create", { title: "   " });
    expect(blankTitle.status).toBe(400);

    const procedure = await createProcedure("Blank validation target");
    const blankStep = await request("/workspaces/procedures/steps/add", {
      procedure,
      text: "\n\t",
    });
    const blankContext = await request("/workspaces/context/notes", { text: "  " });
    expect(blankStep.status).toBe(400);
    expect(blankContext.status).toBe(400);
    expect(await application.concepts.ProcedureMaintaining._steps({ procedure })).toEqual([]);
    expect((await application.concepts.ProcedureMaintaining._procedures({
      space: hostConfig.clubWorkspaceId,
    })).length).toBe(proceduresBefore.length + 1);
  });

  test("enforces the frontend text limits at the server boundary", async () => {
    const proceduresBefore = await application.concepts.ProcedureMaintaining._procedures({
      space: hostConfig.clubWorkspaceId,
    });
    const longTitle = await request("/workspaces/procedures/create", {
      title: "t".repeat(161),
    });
    expect(longTitle.status).toBe(400);

    const procedure = await createProcedure("Length validation target");
    const longStep = await request("/workspaces/procedures/steps/add", {
      procedure,
      text: "s".repeat(501),
    });
    const longNote = await request("/workspaces/context/notes", {
      text: "n".repeat(4_001),
    });
    expect(longStep.status).toBe(400);
    expect(longNote.status).toBe(400);
    expect(await application.concepts.ProcedureMaintaining._steps({ procedure })).toEqual([]);

    const recorded = await request("/workspaces/context/notes", { text: "Original text" });
    const context = requireString(recorded.body.context, "ContextNote");
    const longCorrection = await request("/workspaces/context/correct", {
      context,
      text: "c".repeat(4_001),
    });
    const longChange = await request("/workspaces/context/change", {
      context,
      text: "m".repeat(4_001),
    });
    expect(longCorrection.status).toBe(400);
    expect(longChange.status).toBe(400);
    expect(await application.concepts.ContextTracking._get({ context })).toEqual([{
      scope: hostConfig.clubWorkspaceId,
      text: "Original text",
    }]);
    expect(await application.concepts.ContextTracking._changes({ context })).toEqual([]);
    expect((await application.concepts.ProcedureMaintaining._procedures({
      space: hostConfig.clubWorkspaceId,
    })).length).toBe(proceduresBefore.length + 1);
  });

  test("rejects an unavailable attachment target without creating an attachment", async () => {
    const firstProcedure = await createProcedure("Attachment target A");
    const secondProcedure = await createProcedure("Attachment target B");
    const secondStepResponse = await request("/workspaces/procedures/steps/add", {
      procedure: secondProcedure,
      text: "Belongs only to B",
    });
    const contextResponse = await request("/workspaces/context/notes", { text: "Scoped target note" });
    const context = requireString(contextResponse.body.context, "ContextNote");
    const secondStep = requireString(secondStepResponse.body.step, "Step");

    const mismatch = await request("/workspaces/context/step-attachments", {
      context,
      procedure: firstProcedure,
      step: secondStep,
    });
    expect(mismatch.status).toBe(404);
    expect(mismatch.body.error).toBe("NOT_FOUND");
    expect(await application.concepts.ContextTracking._attachments({ context })).toEqual([]);
  });

  test("runs the shared-context workflow, builds both Reviews, and confirms one", async () => {
    const firstProcedure = await createProcedure("Shared dependency first");
    const secondProcedure = await createProcedure("Shared dependency second");
    const firstStepResult = await request("/workspaces/procedures/steps/add", {
      procedure: firstProcedure,
      text: "First Step",
    });
    const firstStep = firstStepResult.body.step;
    if (typeof firstStep !== "string") throw new Error("Step creation did not return a Step.");
    const secondFirstProcedureStep = await request("/workspaces/procedures/steps/add", {
      procedure: firstProcedure,
      text: "Second Step",
    });
    expect(secondFirstProcedureStep.status).toBe(200);
    const secondStepIdentity = requireString(
      secondFirstProcedureStep.body.step,
      "Second Step",
    );
    await request("/workspaces/procedures/steps/add", {
      procedure: secondProcedure,
      text: "Second Step",
    });

    const procedures = await request("/workspaces/procedures", {});
    const listedProcedures = procedures.body.procedures as {
      procedure: string;
      steps: { step: string; position: number }[];
    }[];
    const firstListed = listedProcedures.find(({ procedure }) => procedure === firstProcedure);
    expect(firstListed?.steps.map(({ step }) => step)).toEqual([
      firstStep,
      secondStepIdentity,
    ]);
    expect(firstListed?.steps.map(({ position }) => position)).toEqual([1, 2]);
    const note = await request("/workspaces/context/notes", { text: "Old policy" });
    const context = requireString(note.body.context, "ContextNote");
    expect(note.status).toBe(200);
    const attached = await request("/workspaces/context/attachments", {
      context,
      procedure: firstProcedure,
    });
    const anchored = await request("/workspaces/context/step-attachments", {
      context,
      procedure: firstProcedure,
      step: firstStep,
    });
    const secondAttachment = await request("/workspaces/context/attachments", {
      context,
      procedure: secondProcedure,
    });
    expect(attached.status).toBe(200);
    expect(anchored.status).toBe(200);
    expect(secondAttachment.status).toBe(200);

    const correction = await request("/workspaces/context/correct", {
      context,
      text: "Corrected wording, same meaning",
    });
    expect(correction.status).toBe(200);
    await application.whenIdle();
    const beforeMeaningfulChange = await request("/workspaces/reviews/pending", {});
    expect(beforeMeaningfulChange.body.reviews).toEqual([]);

    const changed = await request("/workspaces/context/change", {
      context,
      text: "New policy changes the underlying assumption",
    });
    expect(changed.status).toBe(200);
    await application.whenIdle();

    const pending = await request("/workspaces/reviews/pending", {});
    const reviews = pending.body.reviews as {
      review: string;
      procedure: string;
      status: string;
      causes: { cause: string; before: string; after: string }[];
    }[];
    expect(reviews).toHaveLength(2);
    expect(reviews.map(({ procedure }) => procedure).toSorted()).toEqual(
      [firstProcedure, secondProcedure].toSorted(),
    );
    const change = requireString(changed.body.change, "Change");
    for (const review of reviews) {
      expect(review.status).toBe("PENDING");
      expect(review.causes).toContainEqual({
        cause: change,
        before: "Corrected wording, same meaning",
        after: "New policy changes the underlying assumption",
      });
    }

    const confirmed = await request("/workspaces/reviews/confirm", {
      review: reviews[0].review,
      procedure: reviews[0].procedure,
    });
    expect(confirmed).toEqual({
      status: 200,
      body: { review: reviews[0].review, status: "COMPLETE" },
    });
    const afterConfirm = await request("/workspaces/reviews/pending", {});
    expect(afterConfirm.body.reviews).toHaveLength(1);
    const historyResponse = await request("/workspaces/reviews", {});
    expect(historyResponse.status).toBe(200);
    const reviewHistory = historyResponse.body.procedures as {
      procedure: string;
      title: string;
      reviews: {
        status: string;
        causes: { cause: string; before: string; after: string }[];
      }[];
    }[];
    const persistedReviews = reviewHistory
      .filter(({ procedure }) => [firstProcedure, secondProcedure].includes(procedure))
      .flatMap(({ reviews }) => reviews);
    expect(persistedReviews.map(({ status }) => status).toSorted()).toEqual([
      "COMPLETE",
      "PENDING",
    ]);
    expect(persistedReviews.find(({ status }) => status === "COMPLETE")?.causes).toContainEqual({
      cause: change,
      before: "Corrected wording, same meaning",
      after: "New policy changes the underlying assumption",
    });
    const duplicateConfirm = await request("/workspaces/reviews/confirm", {
      review: reviews[0].review,
      procedure: reviews[0].procedure,
    });
    expect(duplicateConfirm.status).toBe(404);
    expect(duplicateConfirm.body.error).toBe("NOT_FOUND");
    const unchangedChange = await request("/workspaces/context/change", {
      context,
      text: "New policy changes the underlying assumption",
    });
    expect(unchangedChange.status).toBe(400);
    expect(unchangedChange.body.error).toBe("INVALID_REQUEST");

    const history = await request("/workspaces/context", {});
    const histories = history.body.contexts as {
      context: string;
      attachments: { subject: string; anchor: string | null }[];
      changes: { change: string; before: string; after: string }[];
    }[];
    const noteHistory = histories.find((entry) => entry.context === context);
    expect(noteHistory?.attachments).toHaveLength(3);
    expect(noteHistory?.attachments.some((entry) => entry.anchor === firstStep)).toBe(true);
    expect(noteHistory?.attachments.filter((entry) => entry.anchor === null)).toHaveLength(2);
    expect(noteHistory?.changes).toContainEqual({
      change,
      before: "Corrected wording, same meaning",
      after: "New policy changes the underlying assumption",
    });
  });

  test("returns no mutation for missing resources and refuses duplicate note attachments", async () => {
    const missingContext = await request("/workspaces/context/attachments", {
      context: "missing-context",
      procedure: "missing-procedure",
    });
    expect(missingContext.status).toBe(404);
    expect(missingContext.body.error).toBe("NOT_FOUND");

    const procedure = await createProcedure("Attachment refusal");
    const recorded = await application.concepts.ContextTracking.record({
      scope: hostConfig.clubWorkspaceId,
      text: "Scoped note",
    });
    const context = requireString(recorded.context, "ContextNote");
    await request("/workspaces/context/attachments", { context, procedure });
    const duplicate = await request("/workspaces/context/attachments", { context, procedure });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("CONFLICT");
  });
});
