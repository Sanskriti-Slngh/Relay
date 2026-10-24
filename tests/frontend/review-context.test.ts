import { describe, expect, test } from "bun:test";
import type { ContextNote, Step } from "../../web/api.ts";
import { contextConnectionsForReview, contextScopeForReviewCause, stepForReviewRepair } from "../../web/review-context.ts";

function note(
  changes: string[],
  attachments: { attachment: string; subject: string; anchor: string | null }[],
): ContextNote {
  return {
    context: "context-1",
    text: "Shared information",
    version: 2,
    changes: changes.map((change) => ({ change, before: "Before", after: "After", occurredAt: null })),
    attachments,
  };
}

describe("Review context attachment scope", () => {
  test("opens the attached Step directly and gives whole-Playbook context an explicit first Step", () => {
    const steps = [
      { step: "step-1", text: "First instruction", position: 1, version: 1 },
      { step: "step-2", text: "Affected instruction", position: 2, version: 3 },
    ] as Step[];

    expect(stepForReviewRepair("step-2", steps)?.step).toBe("step-2");
    expect(stepForReviewRepair(null, steps)?.step).toBe("step-1");
    expect(stepForReviewRepair(null, steps, "step-2")?.step).toBe("step-2");
    expect(stepForReviewRepair("removed-step", steps)).toBeUndefined();
    expect(stepForReviewRepair(undefined, steps)).toBeUndefined();
  });

  test("finds and deduplicates the exact Steps attached to the changed Context Note", () => {
    const scope = contextScopeForReviewCause("change-1", "playbook-1", [note(
      ["change-1"],
      [
        { attachment: "attachment-1", subject: "playbook-1", anchor: "step-2" },
        { attachment: "attachment-2", subject: "playbook-1", anchor: "step-2" },
        { attachment: "attachment-3", subject: "playbook-1", anchor: "step-4" },
      ],
    )]);

    expect(scope).toEqual({ contextFound: true, found: true, wholePlaybook: false, stepIds: ["step-2", "step-4"] });
  });

  test("distinguishes whole-Playbook attachment from Step attachment", () => {
    const scope = contextScopeForReviewCause("change-1", "playbook-1", [note(
      ["change-1"],
      [
        { attachment: "attachment-1", subject: "playbook-1", anchor: null },
        { attachment: "attachment-2", subject: "playbook-1", anchor: "step-1" },
      ],
    )]);

    expect(scope).toEqual({ contextFound: true, found: true, wholePlaybook: true, stepIds: ["step-1"] });
  });

  test("ignores attachments to other Playbooks and unrelated Context changes", () => {
    const contexts = [
      note(["other-change"], [{ attachment: "attachment-1", subject: "playbook-1", anchor: "wrong-step" }]),
      note(["change-1"], [{ attachment: "attachment-2", subject: "playbook-2", anchor: "other-step" }]),
    ];

    expect(contextScopeForReviewCause("change-1", "playbook-1", contexts)).toEqual({ contextFound: true, found: false, wholePlaybook: false, stepIds: [] });
    expect(contextScopeForReviewCause("missing-change", "playbook-1", contexts)).toEqual({ contextFound: false, found: false, wholePlaybook: false, stepIds: [] });
  });

  test("returns only exact attachment choices caused by this Review", () => {
    const contexts = [
      note(["change-1"], [
        { attachment: "attachment-1", subject: "playbook-1", anchor: "step-1" },
        { attachment: "attachment-2", subject: "playbook-2", anchor: "other-step" },
      ]),
      note(["other-change"], [{ attachment: "attachment-3", subject: "playbook-1", anchor: "step-2" }]),
    ];

    expect(contextConnectionsForReview(["change-1"], "playbook-1", contexts).map(({ attachment }) => attachment.attachment))
      .toEqual(["attachment-1"]);
  });
});
