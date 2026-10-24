import { describe, expect, test } from "bun:test";
import { recordAndAttachInlineContext } from "../../web/inline-context.ts";

describe("inline Context Note save", () => {
  test("records once and attaches the new note", async () => {
    const attached: string[] = [];

    const result = await recordAndAttachInlineContext(
      async () => ({ context: "context-1" }),
      async (context) => { attached.push(context); },
    );

    expect(result).toEqual({ status: "ATTACHED", context: "context-1" });
    expect(attached).toEqual(["context-1"]);
  });

  test("exposes a recorded-only result so retry can reuse the saved note", async () => {
    let recordCalls = 0;
    const attached: string[] = [];
    const attachmentError = new Error("attachment unavailable");

    const result = await recordAndAttachInlineContext(
      async () => { recordCalls += 1; return { context: "context-2" }; },
      async (context) => { attached.push(context); throw attachmentError; },
    );

    expect(result).toEqual({ status: "RECORDED_ONLY", context: "context-2", cause: attachmentError });
    expect(recordCalls).toBe(1);
    expect(attached).toEqual(["context-2"]);

    if (result.status === "RECORDED_ONLY") attached.push(result.context);
    expect(recordCalls).toBe(1);
    expect(attached).toEqual(["context-2", "context-2"]);
  });

  test("does not attempt attachment when recording fails", async () => {
    let attachCalls = 0;

    await expect(recordAndAttachInlineContext(
      async () => { throw new Error("record unavailable"); },
      async () => { attachCalls += 1; },
    )).rejects.toThrow("record unavailable");
    expect(attachCalls).toBe(0);
  });
});
