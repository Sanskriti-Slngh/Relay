<script setup lang="ts">
import { computed, reactive } from "vue";
import type { ContextQuestion, StepQuestion } from "../api.ts";

const props = defineProps<{
  stepQuestions: StepQuestion[];
  contextQuestions: ContextQuestion[];
  actionBusy: string;
  canAnswer: boolean;
}>();

const emit = defineEmits<{
  answer: [payload: {
    kind: "step" | "context";
    question: StepQuestion | ContextQuestion;
    answer: string;
    onSuccess: () => void;
  }];
}>();

const answerDraft = reactive<Record<string, string>>({});
const questions = computed(() => [
  ...props.stepQuestions.map((question) => ({ kind: "step" as const, question })),
  ...props.contextQuestions.map((question) => ({ kind: "context" as const, question })),
]);
const openQuestions = computed(() => questions.value.filter(({ question }) => question.status === "OPEN"));
const answeredQuestions = computed(() => questions.value.filter(({ question }) => question.status === "ANSWERED"));

function answerQuestion(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  const answer = (answerDraft[question.question] ?? "").trim();
  if (!answer) return;
  emit("answer", {
    kind,
    question,
    answer,
    onSuccess: () => { answerDraft[question.question] = ""; },
  });
}

function subjectLabel(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  if (kind === "step") return (question as StepQuestion).title;
  return "Shared context";
}

function isRemovedStep(kind: "step" | "context", question: StepQuestion | ContextQuestion) {
  return kind === "step" && (question as StepQuestion).subjectStatus === "REMOVED";
}
</script>

<template>
  <div class="page-heading heading-with-action">
    <div>
      <p class="eyebrow">NOTHING LEFT HANGING</p>
      <h1>Questions inbox</h1>
      <p class="page-intro">Answer open questions where members encounter uncertainty. Every answer stays with its original question and subject.</p>
    </div>
    <span class="inbox-count">{{ openQuestions.length }} unanswered</span>
  </div>

  <div v-if="!openQuestions.length" class="panel empty-page-state review-empty">
    <span class="empty-icon empty-icon-green">✓</span>
    <h2>No unanswered questions</h2>
    <p>New questions about active Steps and attached Context Notes will appear here for an officer response.</p>
  </div>
  <div v-else class="question-inbox-list">
    <article v-for="entry in openQuestions" :key="`${entry.kind}-${entry.question.question}`" class="panel question-inbox-card">
      <header>
        <div><p class="eyebrow">{{ entry.kind === "step" ? "STEP QUESTION" : "CONTEXT QUESTION" }}</p><h2>{{ subjectLabel(entry.kind, entry.question) }}</h2></div>
        <span class="badge badge-pending">Open</span>
      </header>
      <div class="question-subject-copy">
        <span>ABOUT</span>
        <p>{{ entry.question.subjectText }}</p>
        <small v-if="isRemovedStep(entry.kind, entry.question)">This Step was removed, but its identity and Question are preserved.</small>
      </div>
      <blockquote>{{ entry.question.text }}</blockquote>
      <form v-if="canAnswer" class="question-answer-form" @submit.prevent="answerQuestion(entry.kind, entry.question)">
        <label :for="`answer-${entry.question.question}`">Officer answer</label>
        <textarea :id="`answer-${entry.question.question}`" v-model="answerDraft[entry.question.question]" placeholder="Give a clear answer that future readers can rely on…" required maxlength="2000" rows="3"></textarea>
        <button class="button button-primary" type="submit" :disabled="!!actionBusy || !(answerDraft[entry.question.question] ?? '').trim()">{{ actionBusy === `answer-${entry.question.question}` ? "Answering…" : "Answer question" }}</button>
      </form>
      <p v-else class="subtle-empty">An Officer will answer this question.</p>
    </article>
  </div>

  <section v-if="answeredQuestions.length" class="panel completed-history question-history">
    <div class="panel-heading"><div><p class="eyebrow">PRESERVED RESOLUTIONS</p><h2>Answered questions</h2></div><span class="badge badge-complete">{{ answeredQuestions.length }} answered</span></div>
    <article v-for="entry in answeredQuestions" :key="`${entry.kind}-${entry.question.question}`" class="answered-question">
      <div class="answered-question-heading"><strong>{{ subjectLabel(entry.kind, entry.question) }}</strong><span>{{ entry.kind === "step" ? "Step" : "Context" }}</span></div>
      <p class="answered-question-text">{{ entry.question.text }}</p>
      <p class="answered-question-answer"><span>Answer</span>{{ entry.question.answer }}</p>
    </article>
  </section>
</template>
