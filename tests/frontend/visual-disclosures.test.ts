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
