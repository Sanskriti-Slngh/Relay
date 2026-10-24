import { describe, expect, test } from "bun:test";
import { discardAfterSuccessfulAction, hasChangedDraft, hasMeaningfulDraft, shouldConfirmDiscard } from "../../web/unsaved-work.ts";

describe("unsaved-work protection", () => {
  test("ignores empty forms but detects meaningful local text", () => {
    expect(hasMeaningfulDraft([undefined, "", "   "])).toBe(false);
    expect(hasMeaningfulDraft(["", "keep this draft"])).toBe(true);
  });

  test("warns only when an action would leave a dirty editor", () => {
    expect(shouldConfirmDiscard(false, true)).toBe(false);
    expect(shouldConfirmDiscard(true, false)).toBe(false);
    expect(shouldConfirmDiscard(true, true)).toBe(true);
  });

  test("detects a hidden changed draft when another editing mode is selected", () => {
    expect(hasChangedDraft("saved note", ["saved note", "changed wording"])).toBe(true);
    expect(hasChangedDraft("saved note", ["saved note", "saved note"])).toBe(false);
  });

  test("discards local state only after an asynchronous action succeeds", async () => {
    let discarded = false;
    await expect(discardAfterSuccessfulAction(async () => "saved", () => { discarded = true; })).resolves.toBe("saved");
    expect(discarded).toBe(true);

    discarded = false;
    await expect(discardAfterSuccessfulAction(async () => { throw new Error("request failed"); }, () => { discarded = true; })).rejects.toThrow("request failed");
    expect(discarded).toBe(false);
  });
});
