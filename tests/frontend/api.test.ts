import { describe, expect, test } from "bun:test";
import { createRelayApi, RelayApiError } from "../../web/api.ts";

describe("Relay browser API client", () => {
  test("uses account, workspace, and invitation routes without client identities", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ authenticated: true, csrfToken: "csrf" });
    });
    await api.register("member@example.org", "secure password", "Member");
    await api.signIn("member@example.org", "secure password");
    await api.createWorkspace("Robotics", "csrf");
    await api.selectWorkspace("workspace-id", "csrf");
    await api.renameWorkspace("Robotics Team", "csrf");
    await api.archiveWorkspace("csrf");
    await api.restoreWorkspace("workspace-id", "csrf");
    await api.deleteWorkspace("workspace-id", "Robotics Team", "csrf");
    await api.workspaceMembers("csrf");
    await api.claimOwnership("csrf");
    await api.changeMemberRole("member-id", "Officer", "csrf");
    await api.removeMember("member-id", "csrf");
    await api.transferOwnership("member-id", "Member", "csrf");
    await api.recentActivity("csrf");
    await api.pendingInvitations("csrf");
    await api.createInvitation("invitee@example.org", "csrf");
    await api.reissueInvitation("invitation-id", "csrf");
    await api.acceptInvitation("invite-token", "csrf");
    expect(calls.map(({ input }) => input)).toEqual(["/auth/register", "/auth/login", "/workspaces/create", "/workspaces/select", "/workspaces/rename", "/workspaces/archive", "/workspaces/restore", "/workspaces/delete", "/workspaces/members", "/workspaces/ownership/claim", "/workspaces/members/role", "/workspaces/members/remove", "/workspaces/ownership/transfer", "/workspaces/activity", "/invitations/pending", "/invitations/create", "/invitations/reissue", "/invitations/accept"]);
    for (const { init } of calls) expect(init?.body).not.toContain('"user"');
    for (const { init } of calls.slice(2)) expect(new Headers(init?.headers).get("X-Relay-CSRF")).toBe("csrf");
  });
  test("exchanges the operator-entered credential for a same-origin session without persisting it", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({
        authenticated: true,
        csrfToken: "csrf-value",
        workspace: "club-workspace",
      });
    });
    const credential = "operator-entered-local-credential";

    const session = await api.login(credential);

    expect(session).toEqual({
      authenticated: true,
      csrfToken: "csrf-value",
      workspace: "club-workspace",
    });
    expect(calls[0].input).toBe("/session");
    expect(calls[0].init?.credentials).toBe("same-origin");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ credential });
    expect(calls[0].init?.headers).toEqual({ "Content-Type": "application/json" });
  });

  test("sends logout as explicit empty JSON so development proxies cannot create an ambiguous empty stream", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ authenticated: false });
    });

    await api.logout("csrf");

    expect(calls[0].input).toBe("/session/logout");
    expect(new Headers(calls[0].init?.headers).get("content-type")).toBe("application/json");
    expect(new Headers(calls[0].init?.headers).get("x-relay-csrf")).toBe("csrf");
    expect(calls[0].init?.body).toBe("{}");
  });

  test("sends a CSRF token and no caller-controlled identity on composition operations", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ procedure: "created-procedure" });
    });

    await api.createProcedure("Club event setup", "session-csrf");

    expect(calls[0].input).toBe("/api/workspaces/procedures/create");
    expect(calls[0].init?.credentials).toBe("same-origin");
    expect(new Headers(calls[0].init?.headers).get("X-Relay-CSRF")).toBe("session-csrf");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ title: "Club event setup" });
  });

  test("archives a Playbook through the authorized composition endpoint", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ procedure: "archived-procedure", status: "RETIRED" });
    });

    await expect(api.archiveProcedure("archived-procedure", 4, "session-csrf")).resolves.toEqual({
      procedure: "archived-procedure",
      status: "RETIRED",
    });

    expect(calls[0].input).toBe("/api/workspaces/procedures/archive");
    expect(new Headers(calls[0].init?.headers).get("X-Relay-CSRF")).toBe("session-csrf");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      procedure: "archived-procedure",
      expectedVersion: 4,
    });
  });

  test("detaches one exact Context relationship without sending its workspace from the browser", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ attachment: "attachment-1" });
    });

    await expect(api.detachContextNote("attachment-1", "context-1", "procedure-1", "session-csrf")).resolves.toEqual({ attachment: "attachment-1" });
    expect(calls[0].input).toBe("/api/workspaces/context/detach");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ attachment: "attachment-1", context: "context-1", procedure: "procedure-1" });
    expect(new Headers(calls[0].init?.headers).get("X-Relay-CSRF")).toBe("session-csrf");
  });

  test("permanently deletes a versioned Context Note through its dedicated endpoint", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ context: "context-1" });
    });

    await expect(api.deleteContextNote("context-1", 3, "session-csrf")).resolves.toEqual({ context: "context-1" });
    expect(calls[0].input).toBe("/api/workspaces/context/delete");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ context: "context-1", expectedVersion: 3 });
    expect(new Headers(calls[0].init?.headers).get("X-Relay-CSRF")).toBe("session-csrf");
  });

  test("sends Playbook editing and Review lifecycle operations to their composition endpoints", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({});
    });

    await api.renameProcedure("procedure", "Renamed", 3, "csrf");
    await api.editStep("procedure", "step", "Edited", 7, "csrf");
    await api.moveStep("procedure", "step", 2, 3, "csrf");
    await api.removeStep("procedure", "step", 3, "csrf");
    await api.requireReviewChanges("review", "procedure", 2, "csrf");
    await api.resolveReview("review", "procedure", 3, "csrf");
    await api.cancelReview("review", "procedure", 2, "csrf");

    expect(calls.map(({ input }) => input)).toEqual([
      "/api/workspaces/procedures/rename",
      "/api/workspaces/procedures/steps/edit",
      "/api/workspaces/procedures/steps/move",
      "/api/workspaces/procedures/steps/remove",
      "/api/workspaces/reviews/require-changes",
      "/api/workspaces/reviews/resolve",
      "/api/workspaces/reviews/cancel",
    ]);
    expect(calls.map(({ init }) => JSON.parse(String(init?.body)))).toEqual([
      { procedure: "procedure", title: "Renamed", expectedVersion: 3 },
      { procedure: "procedure", step: "step", text: "Edited", expectedVersion: 7 },
      { procedure: "procedure", step: "step", position: 2, expectedVersion: 3 },
      { procedure: "procedure", step: "step", expectedVersion: 3 },
      { review: "review", procedure: "procedure", expectedVersion: 2 },
      { review: "review", procedure: "procedure", expectedVersion: 3 },
      { review: "review", procedure: "procedure", expectedVersion: 2 },
    ]);
    expect(calls.every(({ init }) => new Headers(init?.headers).get("X-Relay-CSRF") === "csrf"))
      .toBe(true);
  });

  test("sends Question reads, asks, answers, and owned revisions without caller-controlled identities", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const api = createRelayApi(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ stepQuestions: [], contextQuestions: [] });
    });

    await api.questions("csrf");
    await api.askStepQuestion("procedure", "step", "Step question?", "csrf");
    await api.askContextQuestion("procedure", "context", "Context question?", "csrf");
    await api.answerStepQuestion("step-question", "Step answer.", 1, "csrf");
    await api.answerContextQuestion("context-question", "Context answer.", 1, "csrf");
    await api.reviseStepQuestionAnswer("step-question", "Revised step answer.", 2, "csrf");
    await api.reviseContextQuestionAnswer("context-question", "Revised context answer.", 2, "csrf");
    await api.removeStepQuestion("step-question", 3, "csrf");
    await api.removeContextQuestion("context-question", 3, "csrf");

    expect(calls.map(({ input }) => input)).toEqual([
      "/api/workspaces/questions",
      "/api/workspaces/questions/steps/ask",
      "/api/workspaces/questions/context/ask",
      "/api/workspaces/questions/steps/answer",
      "/api/workspaces/questions/context/answer",
      "/api/workspaces/questions/steps/revise",
      "/api/workspaces/questions/context/revise",
      "/api/workspaces/questions/steps/remove",
      "/api/workspaces/questions/context/remove",
    ]);
    expect(calls.map(({ init }) => JSON.parse(String(init?.body)))).toEqual([
      {},
      { procedure: "procedure", step: "step", text: "Step question?" },
      { procedure: "procedure", context: "context", text: "Context question?" },
      { question: "step-question", answer: "Step answer.", expectedVersion: 1 },
      { question: "context-question", answer: "Context answer.", expectedVersion: 1 },
      { question: "step-question", answer: "Revised step answer.", expectedVersion: 2 },
      { question: "context-question", answer: "Revised context answer.", expectedVersion: 2 },
      { question: "step-question", expectedVersion: 3 },
      { question: "context-question", expectedVersion: 3 },
    ]);
    expect(calls.every(({ init }) => !String(init?.body).includes("user"))).toBe(true);
  });

  test("surfaces unauthenticated API responses as an explicit sign-in error", async () => {
    const api = createRelayApi(async () => Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401 },
    ));

    await expect(api.procedures("csrf")).rejects.toBeInstanceOf(RelayApiError);
    await expect(api.procedures("csrf")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Your session has expired. Sign in again.",
    });
  });

  test("keeps invitation failures generic while providing recovery steps", async () => {
    const api = createRelayApi(async () => Response.json(
      { error: "INVITATION_NOT_AVAILABLE" },
      { status: 404 },
    ));

    await expect(api.acceptInvitation("unknown-token", "csrf")).rejects.toMatchObject({
      status: 404,
      code: "INVITATION_NOT_AVAILABLE",
      message: "Relay could not accept that invitation. Check that you are signed in with the invited email address and that the code is correct. If it still does not work, ask an Owner or Officer for a new invitation.",
    });
  });

  test("distinguishes an invalid browser origin from an Officer permission denial", async () => {
    const api = createRelayApi(async () => Response.json(
      { error: "ORIGIN_REJECTED" },
      { status: 403 },
    ));

    await expect(api.login("local-credential")).rejects.toMatchObject({
      status: 403,
      code: "ORIGIN_REJECTED",
      message: "Relay rejected a request from an untrusted site.",
    });
  });

  test("surfaces actionable messages for guarded failure paths", async () => {
    const staleApi = createRelayApi(async () =>
      Response.json({ error: "VERSION_CONFLICT" }, { status: 409 }),
    );
    await expect(staleApi.editStep("procedure", "step", "My preserved draft", 2, "csrf"))
      .rejects.toMatchObject({
        code: "VERSION_CONFLICT",
        message: "Someone changed this while you were working. Your draft is still here—compare it with the latest version before saving again.",
      });

    const conflictApi = createRelayApi(async () =>
      Response.json({ error: "CONFLICT" }, { status: 409 }),
    );
    await expect(conflictApi.attachContextNote("context", "procedure", "csrf"))
      .rejects.toMatchObject({
        code: "ATTACHMENT_ALREADY_EXISTS",
        message: "That context note is already attached to the selected target.",
      });
    await expect(conflictApi.confirmReview("review", "procedure", 1, "csrf"))
      .rejects.toMatchObject({
        code: "REVIEW_NOT_PENDING_FOR_CONFIRMATION",
        message: "That review is no longer pending and cannot be confirmed again.",
      });
    await expect(conflictApi.requireReviewChanges("review", "procedure", 1, "csrf"))
      .rejects.toMatchObject({ code: "REVIEW_NOT_PENDING_FOR_CHANGES" });
    await expect(conflictApi.resolveReview("review", "procedure", 1, "csrf"))
      .rejects.toMatchObject({ code: "REVIEW_NOT_AWAITING_CHANGES" });
    await expect(conflictApi.cancelReview("review", "procedure", 1, "csrf"))
      .rejects.toMatchObject({ code: "CANCEL_REVIEW_FINISHED" });
    await expect(conflictApi.answerStepQuestion("question", "answer", 1, "csrf"))
      .rejects.toMatchObject({
        code: "QUESTION_NOT_OPEN",
        message: "That question has already been answered.",
      });

    const completedApi = createRelayApi(async () =>
      Response.json({ error: "NOT_FOUND" }, { status: 404 }),
    );
    await expect(completedApi.confirmReview("review", "procedure", 1, "csrf"))
      .rejects.toMatchObject({
        code: "REVIEW_NOT_AVAILABLE",
        message: "That review is no longer pending or available in this workspace.",
      });
    await expect(completedApi.askStepQuestion("procedure", "step", "question", "csrf"))
      .rejects.toMatchObject({ code: "QUESTION_SUBJECT_NOT_AVAILABLE" });
    await expect(completedApi.answerContextQuestion("question", "answer", 1, "csrf"))
      .rejects.toMatchObject({ code: "QUESTION_NOT_AVAILABLE" });

    const unchangedApi = createRelayApi(async () =>
      Response.json({ error: "INVALID_REQUEST" }, { status: 400 }),
    );
    await expect(unchangedApi.changeContextNote("context", "same", 1, "csrf"))
      .rejects.toMatchObject({
        code: "CHANGE_NOT_DIFFERENT",
        message: "A meaningful change must differ from the current note.",
      });

    const csrfApi = createRelayApi(async () =>
      Response.json({ error: "CSRF_REJECTED" }, { status: 403 }),
    );
    await expect(csrfApi.procedures("csrf")).rejects.toMatchObject({
      code: "CSRF_REJECTED",
      message: "Your session verification failed. Sign in again.",
    });
  });
});
