import { describe, expect, test } from "bun:test";
import { balancedAttentionItems } from "../../web/attention.ts";

describe("Overview attention selection", () => {
  test("keeps both Reviews and Questions visible when both have many items", () => {
    const items = balancedAttentionItems(
      ["review-1", "review-2", "review-3", "review-4"],
      ["question-1", "question-2", "question-3", "question-4"],
      4,
    );
    expect(items).toEqual(["review-1", "question-1", "review-2", "question-2"]);
  });

  test("fills remaining attention space from the nonempty inbox", () => {
    expect(balancedAttentionItems(["review-1"], ["question-1", "question-2", "question-3"], 4))
      .toEqual(["review-1", "question-1", "question-2", "question-3"]);
  });
});
