import { describe, expect, test } from "bun:test";

describe("visual disclosure hierarchy", () => {
  test("coordinates Context actions and keeps question drafts in local state", async () => {
    const source = await Bun.file(new URL("../../web/components/ContextView.vue", import.meta.url)).text();
    expect(source).toContain("closeOtherDisclosures");
    expect(source).toContain('closeOtherDisclosures(note, "edit")');
    expect(source).toContain('closeOtherDisclosures(note, "attach")');
    expect(source).toContain('closeOtherDisclosures(note, "question")');
    expect(source).toContain("Keep this unsent question as a draft");
    expect(source).not.toContain("questionDraft[openQuestion] =");
  });

  test("keeps Owner-only management behind focused disclosures", async () => {
    const source = await Bun.file(new URL("../../web/components/WorkspaceView.vue", import.meta.url)).text();
    expect(source).toContain("Advanced workspace management");
    expect(source).toContain('class="administrative-disclosure"');
    expect(source).toContain("Transfer ownership");
    expect(source).toContain("Archive workspace");
  });

  test("defaults Context replacement to writing when selection has no valid options", async () => {
    const source = await Bun.file(new URL("../../web/components/ReviewsView.vue", import.meta.url)).text();
    expect(source).toContain('!notes.length && replacementMode.value === "existing"');
  });

  test("Reviews modal passes the Review alongside each mutation instead of firing a separate requireChanges emit", async () => {
    const source = await Bun.file(new URL("../../web/components/ReviewsView.vue", import.meta.url)).text();
    // The previous ensureNeedsUpdating helper raced requireChanges against the mutation
    // because both emits became separate runAction calls in App.vue. The Review is now
    // bundled into each mutation payload so App.vue can sequence them in one runAction.
    expect(source).not.toContain("function ensureNeedsUpdating");
    expect(source).not.toContain("ensureNeedsUpdating(preview.value.review)");
    expect(source).toContain("review: preview.value.review,");
    expect(source).toContain("review: preview.value?.review,");
  });

  test("Pending-Review mutations run requireReviewChanges and the mutation inside one runAction", async () => {
    const source = await Bun.file(new URL("../../web/App.vue", import.meta.url)).text();
    // editStep sequences the transition then the save in one busy window.
    expect(source).toMatch(/needsReviewTransition = review\?\.status === "PENDING";[\s\S]*?runAction\(`edit-\$\{step\.step\}`[\s\S]*?if \(needsReviewTransition\) \{[\s\S]*?api\.requireReviewChanges[\s\S]*?api\.editStep/);
    // detachContext sequences the transition then the detach in one busy window.
    expect(source).toMatch(/needsReviewTransition = review\?\.status === "PENDING";[\s\S]*?runAction\([\s\S]*?`detach-\$\{attachment\.attachment\}`[\s\S]*?if \(needsReviewTransition\) \{[\s\S]*?api\.requireReviewChanges[\s\S]*?api\.detachContextNote/);
    // replaceReviewContext calls requireReviewChanges before attempting the replacement.
    expect(source).toMatch(/replace-context-\$\{attachment\.attachment\}[\s\S]*?review\?\.status === "PENDING"[\s\S]*?api\.requireReviewChanges[\s\S]*?replaceContextConnection/);
  });

  test("keeps Step Questions compact and preserves hidden drafts", async () => {
    const source = await Bun.file(new URL("../../web/components/PlaybooksView.vue", import.meta.url)).text();
    expect(source).toContain('class="step-question-item"');
    expect(source).toContain("+ Ask another question");
    expect(source).toContain("questionFormOpen[step.step] = false");
    expect(source).toContain('stepMode[step.step] === "questions"');
    expect(source).toContain('class="step-question-copy"');
    expect(source).toContain('class="step-answer-copy"');
    expect(source).toContain('questionDate(question.askedAt)');
    expect(source).toContain('answererName(question.answerer)');
    expect(source).toContain('class="conversation-identifier" aria-hidden="true">R</span><div class="conversation-line"');
    expect(source).toContain('aria-hidden="true">R</span>');
    expect(source).toContain("canRemoveQuestions");
    expect(source).toContain("Delete question");
  });

  test("warns Officers before permanently deleting a Question", async () => {
    const app = await Bun.file(new URL("../../web/App.vue", import.meta.url)).text();
    const questions = await Bun.file(new URL("../../web/components/QuestionsView.vue", import.meta.url)).text();
    expect(app).toContain("It will be deleted forever. This cannot be undone.");
    expect(app).toContain("api.removeStepQuestion");
    expect(app).toContain("api.removeContextQuestion");
    expect(app).toContain("stepQuestions.value = stepQuestions.value.filter");
    expect(app).toContain("contextQuestions.value = contextQuestions.value.filter");
    expect(questions).toContain('@click="removeQuestion(entry.kind, entry.question)"');
  });

  test("coordinates mutually exclusive Step editing and Questions modes", async () => {
    const source = await Bun.file(new URL("../../web/components/PlaybooksView.vue", import.meta.url)).text();
    expect(source).toContain('Record<string, "reading" | "editing" | "questions">');
    expect(source).toContain("Discard the unsaved Step and Context changes before opening Questions?");
    expect(source).toContain("stepMode[step.step] = \"editing\"");
    expect(source).toContain("stepMode[step.step] = \"questions\"");
    expect(source).not.toContain("const questionComposer");
    expect(source).toContain('editSubmode[step.step] = "context"');
    expect(source).toContain('editSubmode[step.step] = "instruction"');
    expect(source).not.toContain("Cancel edit</button>");
    expect(source).not.toContain("+ Attach another note");
  });
});
