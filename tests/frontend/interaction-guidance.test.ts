import { describe, expect, test } from "bun:test";
import {
  meaningfulChangeConsequence,
  meaningfulChangeActionLabel,
  questionActionLabel,
  reviewDecisionGuidance,
} from "../../web/interaction-guidance.ts";

describe("first-time interaction guidance", () => {
  test("states the Review consequence before a meaningful Context change", () => {
    expect(meaningfulChangeConsequence(0)).toBe(
      "No active Playbooks use this note, so this will not create a Review.",
    );
    expect(meaningfulChangeConsequence(1)).toBe(
      "This will preserve the before-and-after text and create or update 1 Playbook Review.",
    );
    expect(meaningfulChangeConsequence(2)).toBe(
      "This will preserve the before-and-after text and create or update 2 Playbook Reviews.",
    );
    expect(meaningfulChangeActionLabel(0)).toBe("Save changed information");
    expect(meaningfulChangeActionLabel(1)).toBe("Save change and review 1 Playbook");
    expect(meaningfulChangeActionLabel(2)).toBe("Save change and review 2 Playbooks");
  });

  test("explains both Review decisions and the required update sequence", () => {
    expect(reviewDecisionGuidance("PENDING")).toContain(
      "Choose Still correct if the instructions already work",
    );
    expect(reviewDecisionGuidance("PENDING")).toContain(
      "Choose Needs updating if the Playbook must change",
    );
    expect(reviewDecisionGuidance("CHANGES_REQUIRED")).toBe(
      "Update the affected Steps or Context attachments here, or open the full Playbook editor. Resolve only when the instructions are current.",
    );
  });

  test("presents question creation as an action before a thread exists", () => {
    expect(questionActionLabel(0)).toBe("Ask a question");
    expect(questionActionLabel(2)).toBe("Questions (2)");
  });
});
