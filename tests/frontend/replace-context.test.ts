import { describe, expect, test } from "bun:test";
import { replaceContextConnection } from "../../web/replace-context.ts";

describe("Review Context replacement", () => {
  test("attaches an existing replacement before detaching the changed Context", async () => {
    const actions: string[] = [];
    const result = await replaceContextConnection({
      replacementContext: "existing-context",
      attach: async (context) => { actions.push(`attach:${context}`); },
      detach: async () => { actions.push("detach:old"); },
    });

    expect(result).toEqual({ status: "REPLACED", context: "existing-context" });
    expect(actions).toEqual(["attach:existing-context", "detach:old"]);
  });

  test("reports a saved new Note when its attachment fails and keeps the original connection", async () => {
    const attachmentError = new Error("attachment failed");
    let detached = false;
    const result = await replaceContextConnection({
      record: async () => "new-context",
      attach: async () => { throw attachmentError; },
      detach: async () => { detached = true; },
    });

    expect(result).toEqual({ status: "RECORDED_ONLY", context: "new-context", cause: attachmentError });
    expect(detached).toBe(false);
  });

  test("reports both attachments when removing the original fails", async () => {
    const detachError = new Error("detach failed");
    const result = await replaceContextConnection({
      replacementContext: "existing-context",
      attach: async () => {},
      detach: async () => { throw detachError; },
    });

    expect(result).toEqual({ status: "BOTH_ATTACHED", context: "existing-context", cause: detachError });
  });
});
