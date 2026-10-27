import { describe, expect, test } from "bun:test";
import {
  meaningfulChangeConsequence,
  meaningfulChangeActionLabel,
  invitationAcceptanceGuidance,
  invitedRegistrationGuidance,
  questionActionLabel,
  reviewDecisionGuidance,
  sessionEndedMessage,
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

  test("explains the email-bound invitation prerequisite without disclosing account state", () => {
    expect(invitedRegistrationGuidance).toContain("exact email address");
    expect(invitationAcceptanceGuidance).toContain("signed in");
    expect(invitationAcceptanceGuidance).toContain("exact email address");
  });

  test("distinguishes session expiration with and without unrecoverable drafts", () => {
    expect(sessionEndedMessage(false)).toBe(
      "Your session expired, so Relay signed you out. Sign in again.",
    );
    expect(sessionEndedMessage(true)).toContain("cannot be recovered");
    expect(sessionEndedMessage(true)).toContain("unsaved text was cleared");
  });

  test("keeps action feedback in a dismissible viewport notification", async () => {
    const app = await Bun.file(new URL("../../web/App.vue", import.meta.url)).text();
    const styles = await Bun.file(new URL("../../web/styles.css", import.meta.url)).text();
    expect(app).toContain('class="notification-region"');
    expect(app).toContain('role="alert"');
    expect(app).toContain('aria-label="Dismiss error"');
    expect(styles).toContain(".notification-region { position: fixed;");
    expect(styles).toContain("top: 64px;");
  });

  test("makes revised prerequisite and empty-state guidance explicit", async () => {
    const context = await Bun.file(new URL("../../web/components/ContextView.vue", import.meta.url)).text();
    const playbooks = await Bun.file(new URL("../../web/components/PlaybooksView.vue", import.meta.url)).text();
    const questions = await Bun.file(new URL("../../web/components/QuestionsView.vue", import.meta.url)).text();
    expect(context).toContain("Attach this note to an active Playbook before asking a question.");
    expect(context).toContain("already attached everywhere");
    expect(playbooks).not.toContain("context-optional");
    expect(playbooks).toContain("does not currently provide a way to restore them");
    expect(questions).toContain("No unanswered questions");
    const app = await Bun.file(new URL("../../web/App.vue", import.meta.url)).text();
    expect(app).toContain("does not currently provide a way to restore it");
  });
});
