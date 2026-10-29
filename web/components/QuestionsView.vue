<script setup lang="ts">
import { computed, onUnmounted, reactive, watch } from "vue";
import type { ContextQuestion, StepQuestion } from "../api.ts";
import VersionConflict from "./VersionConflict.vue";

const props = defineProps<{ stepQuestions: StepQuestion[]; contextQuestions: ContextQuestion[]; actionBusy: string; canAnswer: boolean; currentUserId: string; focusQuestion?: string; focusKind?: "step" | "context" | "" }>();
const emit = defineEmits<{
  answer: [payload: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; answer: string; expectedVersion: number; onSuccess: () => void }];
  revise: [payload: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; answer: string; expectedVersion: number; onSuccess: () => void }];
  remove: [payload: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; onSuccess: () => void }];
  dirtyChange: [dirty: boolean];
}>();
const answerDraft = reactive<Record<string, string>>({});
const editingAnswer = reactive<Record<string, boolean>>({});
const answerVersion = reactive<Record<string, number>>({});
const questions = computed(() => [...props.stepQuestions.map((question) => ({ kind: "step" as const, question })), ...props.contextQuestions.map((question) => ({ kind: "context" as const, question }))]);
const openQuestions = computed(() => questions.value.filter(({ question }) => question.status === "OPEN"));
const answeredQuestions = computed(() => questions.value.filter(({ question }) => question.status === "ANSWERED"));
const hasUnsavedWork = computed(() => questions.value.some(({ question }) => {
  const draft = answerDraft[question.question] ?? "";
  if (!draft.trim()) return false;
  return !editingAnswer[question.question] || draft !== (question.answer ?? "");
}));
watch(hasUnsavedWork, (dirty) => emit("dirtyChange", dirty), { immediate: true });
onUnmounted(() => emit("dirtyChange", false));
function answerQuestion(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  const answer = (answerDraft[question.question] ?? "").trim(); if (!answer) return;
  emit("answer", { kind, question, answer, expectedVersion: answerVersion[question.question] ?? question.version, onSuccess: () => { answerDraft[question.question] = ""; delete answerVersion[question.question]; } });
}
function beginAnswerRevision(question: StepQuestion | ContextQuestion) { answerDraft[question.question] = question.answer ?? ""; answerVersion[question.question] = question.version; editingAnswer[question.question] = true; }
function cancelAnswerRevision(question: StepQuestion | ContextQuestion) { delete answerDraft[question.question]; delete answerVersion[question.question]; delete editingAnswer[question.question]; }
function reviseQuestionAnswer(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  const answer = (answerDraft[question.question] ?? "").trim(); if (!answer) return;
  emit("revise", { kind, question, answer, expectedVersion: answerVersion[question.question] ?? question.version, onSuccess: () => cancelAnswerRevision(question) });
}
function canRevise(question: StepQuestion | ContextQuestion) { return props.canAnswer && question.answerer === props.currentUserId; }
function saveUnsentAsRevision(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  if (!canRevise(question)) return;
  answerVersion[question.question] = question.version;
  reviseQuestionAnswer(kind, question);
}
function subjectLabel(kind: "step" | "context", question: StepQuestion | ContextQuestion) { return kind === "step" ? (question as StepQuestion).title : "Shared context"; }
function isRemovedStep(kind: "step" | "context", question: StepQuestion | ContextQuestion) { return kind === "step" && (question as StepQuestion).subjectStatus === "REMOVED"; }
function removeQuestion(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  emit("remove", { kind, question, onSuccess: () => cancelAnswerRevision(question) });
}
</script>

<template>
  <header class="page-heading heading-with-action"><h1>Questions</h1><span class="status-count" :class="{ attention: openQuestions.length }">{{ openQuestions.length }} unanswered</span></header>

  <div v-if="!openQuestions.length" class="empty-page-state"><h2>No unanswered questions</h2><p>Members ask Questions beside a Step or an attached Context Note. New Questions will appear here for an Officer to answer.</p></div>

  <div v-else class="questions-list">
    <article v-for="entry in openQuestions" :key="`${entry.kind}-${entry.question.question}`" class="qa-card" :class="{ focused: entry.question.question === focusQuestion && entry.kind === focusKind }">
      <div class="qa-row">
        <span class="qa-badge">Q</span>
        <div class="qa-copy">
          <p class="qa-text">{{ entry.question.text }}</p>
          <small class="qa-subject">{{ subjectLabel(entry.kind, entry.question) }} · {{ entry.kind === "step" ? "Step" : "Context" }}</small>
        </div>
        <span class="row-status question-status">Open</span>
      </div>
      <div class="qa-about"><span>About</span><p>{{ entry.question.subjectText }}</p><small v-if="isRemovedStep(entry.kind, entry.question)">The original Step was removed. This question is still preserved.</small></div>
      <form v-if="canAnswer" class="qa-answer-form" @submit.prevent="answerQuestion(entry.kind, entry.question)">
        <span class="qa-badge qa-badge-answer">A</span>
        <div class="qa-answer-body">
          <label class="sr-only" :for="`answer-${entry.question.question}`">Answer</label>
          <textarea :id="`answer-${entry.question.question}`" v-model="answerDraft[entry.question.question]" placeholder="Write an answer…" required maxlength="2000" rows="2" @focus="answerVersion[entry.question.question] ??= entry.question.version"></textarea>
          <div class="form-actions"><button class="button button-primary qa-primary" type="submit" :disabled="!!actionBusy || !(answerDraft[entry.question.question] ?? '').trim()">{{ actionBusy === `answer-${entry.question.question}` ? "Answering…" : "Answer" }}</button><button class="button button-quiet danger-text" type="button" :disabled="!!actionBusy" @click="removeQuestion(entry.kind, entry.question)">Delete question</button></div>
        </div>
      </form>
    </article>
  </div>

  <details v-if="answeredQuestions.length" class="quiet-history question-history">
    <summary>Answered questions <span>{{ answeredQuestions.length }}</span></summary>
    <div class="questions-list answered">
      <article v-for="entry in answeredQuestions" :key="`${entry.kind}-${entry.question.question}`" class="qa-card qa-card-answered">
        <div class="qa-row">
          <span class="qa-badge">Q</span>
          <div class="qa-copy">
            <p class="qa-text">{{ entry.question.text }}</p>
            <small class="qa-subject">{{ subjectLabel(entry.kind, entry.question) }} · {{ entry.kind === "step" ? "Step" : "Context" }}</small>
          </div>
          <span class="row-status complete">Answered</span>
          <button v-if="canAnswer" class="qa-icon-button qa-icon-danger" type="button" :disabled="!!actionBusy" aria-label="Delete question" title="Delete question" @click="removeQuestion(entry.kind, entry.question)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <form v-if="editingAnswer[entry.question.question]" class="qa-answer-form" @submit.prevent="reviseQuestionAnswer(entry.kind, entry.question)">
          <span class="qa-badge qa-badge-answer">A</span>
          <div class="qa-answer-body">
            <label class="sr-only" :for="`revise-${entry.question.question}`">Revise your answer</label>
            <textarea :id="`revise-${entry.question.question}`" v-model="answerDraft[entry.question.question]" required maxlength="2000" rows="2"></textarea>
            <div class="form-actions"><button class="button button-small button-primary qa-primary" type="submit" :disabled="!!actionBusy || !(answerDraft[entry.question.question] ?? '').trim()">{{ actionBusy === `revise-${entry.question.question}` ? "Saving…" : "Save answer" }}</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="cancelAnswerRevision(entry.question)">Cancel</button></div>
            <VersionConflict v-if="answerVersion[entry.question.question] !== entry.question.version" subject="answer" saved-label="Current saved answer" :saved-value="entry.question.answer ?? ''" draft-label="Your unsaved answer" :draft-value="answerDraft[entry.question.question] ?? ''" :busy="!!actionBusy" @use-saved="cancelAnswerRevision(entry.question)" @save-mine="saveUnsentAsRevision(entry.kind, entry.question)" />
          </div>
        </form>
        <template v-else>
          <div class="qa-row qa-row-answer">
            <span class="qa-badge qa-badge-answer">A</span>
            <div class="qa-copy"><p class="qa-text">{{ entry.question.answer }}</p></div>
            <button v-if="canRevise(entry.question) && !answerDraft[entry.question.question]" class="qa-icon-button" type="button" :disabled="!!actionBusy" aria-label="Edit your answer" title="Edit your answer" @click="beginAnswerRevision(entry.question)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
          </div>
          <VersionConflict v-if="answerDraft[entry.question.question]" subject="answer" saved-label="Current saved answer" :saved-value="entry.question.answer ?? ''" draft-label="Your unsent answer" :draft-value="answerDraft[entry.question.question]" :can-save-mine="canRevise(entry.question)" :explanation="canRevise(entry.question) ? 'You originally answered this question, so you may replace your saved answer.' : 'Another Officer answered first. Only that original answerer may revise the saved answer.'" :busy="!!actionBusy" @use-saved="cancelAnswerRevision(entry.question)" @save-mine="saveUnsentAsRevision(entry.kind, entry.question)" />
        </template>
      </article>
    </div>
  </details>
</template>
