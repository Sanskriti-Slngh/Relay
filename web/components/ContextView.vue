<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { ContextNote, ContextQuestion, Procedure } from "../api.ts";

const props = defineProps<{
  contexts: ContextNote[];
  procedures: Procedure[];
  contextQuestions: ContextQuestion[];
  actionBusy: string;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  record: [payload: { text: string; onSuccess: () => void }];
  attach: [payload: { note: ContextNote; procedure: string; step: string; onSuccess: () => void }];
  correct: [payload: { note: ContextNote; text: string; onSuccess: () => void }];
  change: [payload: { note: ContextNote; text: string; onSuccess: () => void }];
  askQuestion: [payload: { note: ContextNote; procedure: string; text: string; onSuccess: () => void }];
  validationError: [message: string];
}>();

const contextDraft = ref("");
const correctionDraft = reactive<Record<string, string>>({});
const changeDraft = reactive<Record<string, string>>({});
const attachmentProcedure = reactive<Record<string, string>>({});
const attachmentStep = reactive<Record<string, string>>({});
const questionDraft = reactive<Record<string, string>>({});
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));

watch(
  () => props.procedures,
  () => {
    for (const context of Object.keys(attachmentProcedure)) {
      if (!activeProcedures.value.some(({ procedure }) => procedure === attachmentProcedure[context])) {
        attachmentProcedure[context] = "";
        attachmentStep[context] = "";
      }
    }
  },
);

function stepsForProcedure(procedureId: string) {
  return props.procedures.find(({ procedure }) => procedure === procedureId)?.steps ?? [];
}

function titleForProcedure(procedureId: string) {
  return props.procedures.find(({ procedure }) => procedure === procedureId)?.title ?? "Unknown playbook";
}

function recordContext() {
  const text = contextDraft.value.trim();
  if (!text) return;
  emit("record", { text, onSuccess: () => { contextDraft.value = ""; } });
}

function attachContext(note: ContextNote) {
  const procedure = attachmentProcedure[note.context] ?? "";
  const step = attachmentStep[note.context] ?? "";
  const target = activeProcedures.value.find((item) => item.procedure === procedure);
  if (!target) {
    emit("validationError", "Choose an available active playbook before attaching this note.");
    return;
  }
  if (step && !target.steps.some((item) => item.step === step)) {
    emit("validationError", "Choose an available step from the selected playbook.");
    return;
  }
  emit("attach", {
    note,
    procedure,
    step,
    onSuccess: () => { attachmentStep[note.context] = ""; },
  });
}

function correctContext(note: ContextNote) {
  const text = (correctionDraft[note.context] ?? "").trim();
  if (!text) return;
  emit("correct", {
    note,
    text,
    onSuccess: () => { correctionDraft[note.context] = ""; },
  });
}

function changeContext(note: ContextNote) {
  const text = (changeDraft[note.context] ?? "").trim();
  if (!text) return;
  if (text === note.text) {
    emit("validationError", "A meaningful change must differ from the current note.");
    return;
  }
  emit("change", {
    note,
    text,
    onSuccess: () => { changeDraft[note.context] = ""; },
  });
}

function questionsForContext(context: string) {
  return props.contextQuestions.filter((question) => question.context === context);
}

function activeAttachedProcedure(note: ContextNote) {
  return note.attachments
    .map(({ subject }) => subject)
    .find((subject) => activeProcedures.value.some(({ procedure }) => procedure === subject));
}

function askQuestion(note: ContextNote) {
  const text = (questionDraft[note.context] ?? "").trim();
  const procedure = activeAttachedProcedure(note);
  if (!text) return;
  if (!procedure) {
    emit("validationError", "Attach this Context Note to an active playbook before asking a question.");
    return;
  }
  emit("askQuestion", {
    note,
    procedure,
    text,
    onSuccess: () => { questionDraft[note.context] = ""; },
  });
}
</script>

<template>
  <div class="page-heading">
    <p class="eyebrow">THE WHY BEHIND THE WORK</p>
    <h1>Shared context</h1>
    <p class="page-intro">Keep useful knowledge connected to the playbooks it informs. Correct wording or record a change in meaning—Relay treats them differently.</p>
  </div>
  <form v-if="canEdit" class="record-context panel" @submit.prevent="recordContext">
    <div class="form-heading"><span class="context-form-icon">“</span><div><h2>Record a context note</h2><p>Capture a decision, constraint, or piece of history your club may need again.</p></div></div>
    <label class="sr-only" for="new-context">Context note</label>
    <textarea id="new-context" v-model="contextDraft" placeholder="Add the background worth carrying forward…" required maxlength="4000" rows="3"></textarea>
    <div class="form-foot"><span>Shared across this workspace</span><button class="button button-primary" type="submit" :disabled="!!actionBusy || !contextDraft.trim()">{{ actionBusy === "record-context" ? "Saving…" : "Save context note" }}</button></div>
  </form>
  <div class="list-heading"><div><span class="eyebrow">WORKSPACE KNOWLEDGE</span><h2>{{ contexts.length }} {{ contexts.length === 1 ? "note" : "notes" }}</h2></div></div>
  <div v-if="!contexts.length" class="panel empty-page-state">
    <span class="empty-icon">▤</span><h2>Context makes the steps meaningful</h2>
    <p>Record a note above, then connect it to one or more playbooks or a specific step.</p>
  </div>
  <div v-else class="context-list">
    <article v-for="note in contexts" :key="note.context" class="panel context-card">
      <div class="context-card-main">
        <span class="quote-mark" aria-hidden="true">“</span>
        <div class="context-card-content"><p class="context-current-text">{{ note.text }}</p><small>Context note <span>·</span> {{ note.changes.length }} {{ note.changes.length === 1 ? "recorded change" : "recorded changes" }}</small></div>
      </div>
      <div class="context-question-section">
        <div v-if="questionsForContext(note.context).length" class="subject-question-list">
          <article v-for="question in questionsForContext(note.context)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }">
            <strong>{{ question.status === "OPEN" ? "Awaiting officer answer" : "Answered" }}</strong>
            <p>{{ question.text }}</p>
            <p v-if="question.answer" class="question-answer"><span>Answer:</span> {{ question.answer }}</p>
          </article>
        </div>
        <form class="inline-form question-form" @submit.prevent="askQuestion(note)">
          <label class="sr-only" :for="`question-${note.context}`">Ask a question about this Context Note</label>
          <input :id="`question-${note.context}`" v-model="questionDraft[note.context]" placeholder="Ask about this context…" required maxlength="1000">
          <button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !activeAttachedProcedure(note) || !(questionDraft[note.context] ?? '').trim()">{{ actionBusy === `ask-context-${note.context}` ? "Sending…" : "Ask question" }}</button>
        </form>
        <p v-if="!activeAttachedProcedure(note)" class="subtle-empty">Attach this note to an active playbook to ask a question.</p>
      </div>
      <div class="attachment-section">
        <div class="section-rule"><span>ATTACHED TO</span><span>{{ note.attachments.length }}</span></div>
        <div v-if="note.attachments.length" class="attachment-chips">
          <span v-for="(attachment, index) in note.attachments" :key="`${attachment.subject}-${attachment.anchor ?? 'whole'}-${index}`" class="attachment-chip">
            <span class="attachment-dot"></span>{{ titleForProcedure(attachment.subject) }}
            <small v-if="attachment.anchor">· Step {{ stepsForProcedure(attachment.subject).find((step) => step.step === attachment.anchor)?.position ?? "" }}</small>
          </span>
        </div>
        <p v-else class="subtle-empty">Not connected to a playbook yet.</p>
        <form v-if="canEdit && activeProcedures.length" class="attach-form" @submit.prevent="attachContext(note)">
          <label class="sr-only" :for="`procedure-for-${note.context}`">Choose a playbook</label>
          <select :id="`procedure-for-${note.context}`" v-model="attachmentProcedure[note.context]" required @change="attachmentStep[note.context] = ''">
            <option value="" disabled>Choose a playbook…</option>
            <option v-for="procedure in activeProcedures" :key="procedure.procedure" :value="procedure.procedure">{{ procedure.title }}</option>
          </select>
          <label class="sr-only" :for="`step-for-${note.context}`">Optional step anchor</label>
          <select :id="`step-for-${note.context}`" v-model="attachmentStep[note.context]" :disabled="!attachmentProcedure[note.context] || !stepsForProcedure(attachmentProcedure[note.context]).length">
            <option value="">Whole playbook</option>
            <option v-for="step in stepsForProcedure(attachmentProcedure[note.context] ?? '')" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option>
          </select>
          <button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !attachmentProcedure[note.context]">{{ actionBusy === `attach-${note.context}` ? "Attaching…" : "Attach" }}</button>
        </form>
        <p v-else-if="canEdit" class="subtle-empty">Create an active playbook before attaching context.</p>
      </div>
      <details v-if="note.changes.length" class="history-section">
        <summary><span class="history-icon" aria-hidden="true">↺</span> Change history <span class="history-count">{{ note.changes.length }}</span></summary>
        <ol class="change-history">
          <li v-for="change in note.changes" :key="change.change">
            <div><span class="change-label">BEFORE</span><p>{{ change.before }}</p></div><span class="change-arrow" aria-hidden="true">↓</span><div><span class="change-label">AFTER</span><p>{{ change.after }}</p></div>
          </li>
        </ol>
      </details>
      <div v-if="canEdit" class="note-actions">
        <form class="note-action-form" @submit.prevent="correctContext(note)">
          <label :for="`correct-${note.context}`">Correct wording <span>· does not create a review</span></label>
          <div class="action-input-row"><input :id="`correct-${note.context}`" v-model="correctionDraft[note.context]" placeholder="Revised wording…" required maxlength="4000"><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(correctionDraft[note.context] ?? '').trim()">Correct</button></div>
        </form>
        <form class="note-action-form meaningful-change-form" @submit.prevent="changeContext(note)">
          <label :for="`change-${note.context}`">Meaningful change <span>· preserves before and after</span></label>
          <div class="action-input-row"><input :id="`change-${note.context}`" v-model="changeDraft[note.context]" placeholder="What changed in meaning?…" required maxlength="4000"><button class="button button-small button-change" type="submit" :disabled="!!actionBusy || !(changeDraft[note.context] ?? '').trim()">{{ actionBusy === `change-${note.context}` ? "Saving…" : "Record change" }}</button></div>
        </form>
      </div>
    </article>
  </div>
</template>
