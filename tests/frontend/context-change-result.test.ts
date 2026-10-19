import { describe, expect, test } from "bun:test";
import type { PendingReview } from "../../web/api.ts";
import { confirmedAffectedPlaybooks } from "../../web/context-change-result.ts";

function review(overrides: Partial<PendingReview>): PendingReview {
  return {
    review: "review-1",
    procedure: "procedure-1",
    title: "Opening the studio",
    status: "PENDING",
    causes: [{ cause: "change-1", before: "Old", after: "New" }],
    ...overrides,
  } as PendingReview;
}

describe("confirmed Context-change results", () => {
  test("lists only refreshed Reviews containing the exact successful Change identity", () => {
    const reviews = [
      review({ review: "review-a", procedure: "procedure-a", title: "Book the hall" }),
      review({ review: "review-b", procedure: "procedure-b", title: "Run rehearsal" }),
      review({ review: "review-old", procedure: "procedure-old", title: "Unrelated", causes: [{ cause: "change-old", before: "Before", after: "After" }] }),
    ];

    expect(confirmedAffectedPlaybooks("change-1", reviews)).toEqual([
      { review: "review-a", procedure: "procedure-a", title: "Book the hall" },
      { review: "review-b", procedure: "procedure-b", title: "Run rehearsal" },
    ]);
  });

  test("does not infer affected Playbooks when the refreshed projection has not confirmed them", () => {
    expect(confirmedAffectedPlaybooks("change-missing", [review({})])).toEqual([]);
  });
});
