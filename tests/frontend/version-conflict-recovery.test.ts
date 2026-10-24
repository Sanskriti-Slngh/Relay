import { describe, expect, test } from "bun:test";
import { RelayApiError } from "../../web/api.ts";
import { refreshAfterVersionConflict } from "../../web/version-conflict-recovery.ts";

describe("version-conflict recovery", () => {
  test("releases the action lock before refreshing authoritative state", async () => {
    let busy = true;
    let refreshedWhileBusy: boolean | undefined;

    const handled = await refreshAfterVersionConflict(
      new RelayApiError(409, "VERSION_CONFLICT"),
      () => { busy = false; },
      async () => { refreshedWhileBusy = busy; },
    );

    expect(handled).toBe(true);
    expect(refreshedWhileBusy).toBe(false);
  });

  test("does not refresh unrelated failures", async () => {
    let released = false;
    let refreshed = false;

    const handled = await refreshAfterVersionConflict(
      new RelayApiError(403, "FORBIDDEN"),
      () => { released = true; },
      async () => { refreshed = true; },
    );

    expect(handled).toBe(false);
    expect(released).toBe(false);
    expect(refreshed).toBe(false);
  });
});
