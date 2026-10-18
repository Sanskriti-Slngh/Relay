<script setup lang="ts">
import { computed, reactive } from "vue";
import type { ContextQuestion, StepQuestion } from "../api.ts";

const props = defineProps<{ stepQuestions: StepQuestion[]; contextQuestions: ContextQuestion[]; actionBusy: string; canAnswer: boolean; currentUserId: string; focusQuestion?: string; focusKind?: "step" | "context" | "" }>();
const emit = defineEmits<{
  answer: [payload: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; answer: string; onSuccess: () => void }];
  revise: [payload: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; answer: string; onSuccess: () => void }];
}>();
const answerDraft = reactive<Record<string, string>>({});
const editingAnswer = reactive<Record<string, boolean>>({});
const questions = computed(() => [...props.stepQuestions.map((question) => ({ kind: "step" as const, question })), ...props.contextQuestions.map((question) => ({ kind: "context" as const, question }))]);
const openQuestions = computed(() => questions.value.filter(({ question }) => question.status === "OPEN"));
const answeredQuestions = computed(() => questions.value.filter(({ question }) => question.status === "ANSWERED"));
function answerQuestion(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  const answer = (answerDraft[question.question] ?? "").trim(); if (!answer) return;
  emit("answer", { kind, question, answer, onSuccess: () => { answerDraft[question.question] = ""; } });
}
function beginAnswerRevision(question: StepQuestion | ContextQuestion) { answerDraft[question.question] = question.answer ?? ""; editingAnswer[question.question] = true; }
function cancelAnswerRevision(question: StepQuestion | ContextQuestion) { delete answerDraft[question.question]; delete editingAnswer[question.question]; }
function reviseQuestionAnswer(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  const answer = (answerDraft[question.question] ?? "").trim(); if (!answer) return;
  emit("revise", { kind, question, answer, onSuccess: () => cancelAnswerRevision(question) });
}
function canRevise(question: StepQuestion | ContextQuestion) { return props.canAnswer && question.answerer === props.currentUserId; }
function subjectLabel(kind: "step" | "context", question: StepQuestion | ContextQuestion) { return kind === "step" ? (question as StepQuestion).title : "Shared context"; }
function isRemovedStep(kind: "step" | "context", question: StepQuestion | ContextQuestion) { return kind === "step" && (question as StepQuestion).subjectStatus === "REMOVED"; }
</script>

<template>
  <header class="page-heading heading-with-action"><h1>Questions</h1><span class="status-count" :class="{ attention: openQuestions.length }">{{ openQuestions.length }} unanswered</span></header>

  <div v-if="!openQuestions.length" class="empty-page-state"><h2>All answered</h2></div>
  <div v-else class="inbox-list">
    <details v-for="entry in openQuestions" :key="`${entry.kind}-${entry.question.question}`" class="inbox-row" :open="entry.question.question === focusQuestion && entry.kind === focusKind">
      <summary><span class="status-dot pending-dot" aria-hidden="true"></span><span class="inbox-row-copy"><strong>{{ entry.question.text }}</strong><small>{{ subjectLabel(entry.kind, entry.question) }} · {{ entry.kind === "step" ? "Step" : "Context" }}</small></span><span class="row-status pending">Open</span></summary>
      <div class="inbox-detail">
        <div class="source-excerpt"><span>About</span><p>{{ entry.question.subjectText }}</p><small v-if="isRemovedStep(entry.kind, entry.question)">The original step was removed. This question is still preserved.</small></div>
        <form v-if="canAnswer" class="question-answer-form" @submit.prevent="answerQuestion(entry.kind, entry.question)"><label :for="`answer-${entry.question.question}`">Answer</label><textarea :id="`answer-${entry.question.question}`" v-model="answerDraft[entry.question.question]" placeholder="Write an answer…" required maxlength="2000" rows="4"></textarea><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(answerDraft[entry.question.question] ?? '').trim()">{{ actionBusy === `answer-${entry.question.question}` ? "Answering…" : "Answer" }}</button></div></form>
      </div>
    </details>
  </div>

  <details v-if="answeredQuestions.length" class="quiet-history question-history"><summary>Answered questions <span>{{ answeredQuestions.length }}</span></summary><div class="history-list"><article v-for="entry in answeredQuestions" :key="`${entry.kind}-${entry.question.question}`" class="history-row"><header><div><strong>{{ entry.question.text }}</strong><small>{{ subjectLabel(entry.kind, entry.question) }} · {{ entry.kind === "step" ? "Step" : "Context" }}</small></div><span class="row-status complete">Answered</span></header><form v-if="editingAnswer[entry.question.question]" class="question-answer-form" @submit.prevent="reviseQuestionAnswer(entry.kind, entry.question)"><label :for="`revise-${entry.question.question}`">Revise your answer</label><textarea :id="`revise-${entry.question.question}`" v-model="answerDraft[entry.question.question]" required maxlength="2000" rows="3"></textarea><div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(answerDraft[entry.question.question] ?? '').trim()">{{ actionBusy === `revise-${entry.question.question}` ? "Saving…" : "Save answer" }}</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="cancelAnswerRevision(entry.question)">Cancel</button></div></form><template v-else><blockquote class="preserved-answer">{{ entry.question.answer }}</blockquote><button v-if="canRevise(entry.question)" class="text-button" type="button" :disabled="!!actionBusy" @click="beginAnswerRevision(entry.question)">Edit your answer</button></template></article></div></details>
</template>
