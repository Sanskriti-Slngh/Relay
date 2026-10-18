import { describe, expect, test } from "bun:test";
import { isHostRoute } from "../../src/main.ts";

describe("Relay top-level HTTP routing", () => {
  test("sends session logout and all other host APIs to the authenticated handler", () => {
    for (const pathname of [
      "/session",
      "/session/logout",
      "/auth/login",
      "/workspaces/members",
      "/invitations/create",
      "/api/workspaces/procedures",
    ]) {
      expect(isHostRoute(pathname)).toBe(true);
    }
  });

  test("keeps frontend assets and unrelated lookalike paths out of the host API", () => {
    for (const pathname of ["/", "/index.html", "/assets/app.js", "/sessions/logout", "/workspacesevil"]) {
      expect(isHostRoute(pathname)).toBe(false);
    }
  });
});
