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
});
