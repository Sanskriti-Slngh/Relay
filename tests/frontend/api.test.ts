import { describe, expect, test } from "bun:test";
import { createRelayApi, RelayApiError } from "../../web/api.ts";

describe("Relay browser API client", () => {
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

    await expect(api.archiveProcedure("archived-procedure", "session-csrf")).resolves.toEqual({
      procedure: "archived-procedure",
      status: "RETIRED",
    });

    expect(calls[0].input).toBe("/api/workspaces/procedures/archive");
    expect(new Headers(calls[0].init?.headers).get("X-Relay-CSRF")).toBe("session-csrf");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      procedure: "archived-procedure",
    });
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
      message: "Your local session has expired. Sign in again.",
    });
  });

  test("surfaces actionable messages for guarded failure paths", async () => {
    const conflictApi = createRelayApi(async () =>
      Response.json({ error: "CONFLICT" }, { status: 409 }),
    );
    await expect(conflictApi.attachContextNote("context", "procedure", "csrf"))
      .rejects.toMatchObject({
        code: "ATTACHMENT_ALREADY_EXISTS",
        message: "That context note is already attached to the selected target.",
      });
    await expect(conflictApi.confirmReview("review", "procedure", "csrf"))
      .rejects.toMatchObject({
        code: "REVIEW_NOT_PENDING_FOR_CONFIRMATION",
        message: "That review is no longer pending and cannot be confirmed again.",
      });

    const completedApi = createRelayApi(async () =>
      Response.json({ error: "NOT_FOUND" }, { status: 404 }),
    );
    await expect(completedApi.confirmReview("review", "procedure", "csrf"))
      .rejects.toMatchObject({
        code: "REVIEW_NOT_AVAILABLE",
        message: "That review is no longer pending or available in this workspace.",
      });

    const unchangedApi = createRelayApi(async () =>
      Response.json({ error: "INVALID_REQUEST" }, { status: 400 }),
    );
    await expect(unchangedApi.changeContextNote("context", "same", "csrf"))
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
