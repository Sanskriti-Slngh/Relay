<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { ContextNote, ContextQuestion, Procedure } from "../api.ts";

const props = defineProps<{ contexts: ContextNote[]; procedures: Procedure[]; contextQuestions: ContextQuestion[]; actionBusy: string; canEdit: boolean }>();
const emit = defineEmits<{
  record: [payload: { text: string; onSuccess: () => void }];
  attach: [payload: { note: ContextNote; procedure: string; step: string; onSuccess: () => void }];
  correct: [payload: { note: ContextNote; text: string; onSuccess: () => void }];
  change: [payload: { note: ContextNote; text: string; onSuccess: () => void }];
  askQuestion: [payload: { note: ContextNote; procedure: string; text: string; onSuccess: () => void }];
  validationError: [message: string];
}>();

const contextDraft = ref("");
const showRecord = ref(false);
const updateOpen = ref("");
const updateMode = reactive<Record<string, "correct" | "change">>({});
const correctionDraft = reactive<Record<string, string>>({});
const changeDraft = reactive<Record<string, string>>({});
const attachmentProcedure = reactive<Record<string, string>>({});
const attachmentStep = reactive<Record<string, string>>({});
const questionDraft = reactive<Record<string, string>>({});
const questionComposer = reactive<Record<string, boolean>>({});
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));

watch(() => props.procedures, () => {
  for (const context of Object.keys(attachmentProcedure)) {
    if (!activeProcedures.value.some(({ procedure }) => procedure === attachmentProcedure[context])) {
      attachmentProcedure[context] = ""; attachmentStep[context] = "";
    }
  }
});

function stepsForProcedure(id: string) { return props.procedures.find(({ procedure }) => procedure === id)?.steps ?? []; }
function titleForProcedure(id: string) { return props.procedures.find(({ procedure }) => procedure === id)?.title ?? "Unknown playbook"; }
function questionsForContext(id: string) { return props.contextQuestions.filter(({ context }) => context === id); }
function activeAttachedProcedure(note: ContextNote) { return note.attachments.map(({ subject }) => subject).find((subject) => activeProcedures.value.some(({ procedure }) => procedure === subject)); }
function openUpdate(note: ContextNote) {
  updateOpen.value = note.context;
  updateMode[note.context] ??= "correct";
  correctionDraft[note.context] = note.text;
  changeDraft[note.context] = note.text;
}
function recordContext() {
  const text = contextDraft.value.trim(); if (!text) return;
  emit("record", { text, onSuccess: () => { contextDraft.value = ""; showRecord.value = false; } });
}
function attachContext(note: ContextNote) {
  const procedure = attachmentProcedure[note.context] ?? "";
  const step = attachmentStep[note.context] ?? "";
  const target = activeProcedures.value.find((item) => item.procedure === procedure);
  if (!target) { emit("validationError", "Choose an available active playbook before attaching this note."); return; }
  if (step && !target.steps.some((item) => item.step === step)) { emit("validationError", "Choose an available step from the selected playbook."); return; }
  emit("attach", { note, procedure, step, onSuccess: () => { attachmentStep[note.context] = ""; } });
}
function correctContext(note: ContextNote) {
  const text = (correctionDraft[note.context] ?? "").trim(); if (!text) return;
  emit("correct", { note, text, onSuccess: () => { correctionDraft[note.context] = ""; updateOpen.value = ""; } });
}
function changeContext(note: ContextNote) {
  const text = (changeDraft[note.context] ?? "").trim(); if (!text) return;
  if (text === note.text) { emit("validationError", "A meaningful change must differ from the current note."); return; }
  emit("change", { note, text, onSuccess: () => { changeDraft[note.context] = ""; updateOpen.value = ""; } });
}
function askQuestion(note: ContextNote) {
  const text = (questionDraft[note.context] ?? "").trim(); const procedure = activeAttachedProcedure(note);
  if (!text) return;
  if (!procedure) { emit("validationError", "Attach this Context Note to an active playbook before asking a question."); return; }
  emit("askQuestion", { note, procedure, text, onSuccess: () => { questionDraft[note.context] = ""; questionComposer[note.context] = false; } });
}
</script>

<template>
  <header class="page-heading heading-with-action">
    <div><h1>Shared context</h1><p class="page-intro">Decisions, constraints, and history that help members understand why a playbook works this way.</p></div>
    <button v-if="canEdit" class="button button-primary" type="button" @click="showRecord = !showRecord">{{ showRecord ? "Close" : "New context note" }}</button>
  </header>

  <form v-if="canEdit && showRecord" class="disclosure-form create-disclosure" @submit.prevent="recordContext">
    <label for="new-context">Context worth carrying forward</label>
    <textarea id="new-context" v-model="contextDraft" placeholder="Record the decision, constraint, or history…" required maxlength="4000" rows="4"></textarea>
    <div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !contextDraft.trim()">{{ actionBusy === "record-context" ? "Saving…" : "Save note" }}</button></div>
  </form>

  <p v-if="!contexts.length" class="context-encouragement">Context is optional. Add it when a step may otherwise seem arbitrary or when future officers will need the reasoning behind a decision.</p>
  <div v-if="!contexts.length" class="empty-page-state"><h2>No shared context yet</h2><p>Your playbooks work without it. Add notes when the explanation matters.</p></div>

  <div v-else class="context-ledger">
    <article v-for="note in contexts" :key="note.context" class="context-entry">
      <header class="context-entry-header">
        <div><p class="context-current-text">{{ note.text }}</p><small>{{ note.attachments.length }} {{ note.attachments.length === 1 ? "dependency" : "dependencies" }} · {{ note.changes.length }} recorded {{ note.changes.length === 1 ? "change" : "changes" }}</small></div>
        <button v-if="canEdit" class="button button-small button-secondary" type="button" @click="updateOpen === note.context ? updateOpen = '' : openUpdate(note)">{{ updateOpen === note.context ? "Close" : "Update" }}</button>
      </header>

      <section v-if="updateOpen === note.context" class="update-disclosure">
        <fieldset>
          <legend>What kind of update is this?</legend>
          <label><input v-model="updateMode[note.context]" type="radio" value="correct"> <span><strong>Wording correction</strong><small>Fixes phrasing or a typo. Does not create a Review.</small></span></label>
          <label><input v-model="updateMode[note.context]" type="radio" value="change"> <span><strong>Meaningful change</strong><small>Changes the information. Preserves before and after and may create Reviews.</small></span></label>
        </fieldset>
        <form v-if="updateMode[note.context] === 'correct'" @submit.prevent="correctContext(note)"><label :for="`correct-${note.context}`">Corrected wording</label><textarea :id="`correct-${note.context}`" v-model="correctionDraft[note.context]" required maxlength="4000" rows="3"></textarea><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(correctionDraft[note.context] ?? '').trim()">Save correction</button></div></form>
        <form v-else @submit.prevent="changeContext(note)"><label :for="`change-${note.context}`">Updated information</label><textarea :id="`change-${note.context}`" v-model="changeDraft[note.context]" required maxlength="4000" rows="3"></textarea><p class="form-guidance pending-guidance">Relay will preserve both versions and request Reviews for affected active playbooks.</p><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(changeDraft[note.context] ?? '').trim()">{{ actionBusy === `change-${note.context}` ? "Saving…" : "Record meaningful change" }}</button></div></form>
      </section>

      <section class="context-dependencies" aria-label="Playbook dependencies">
        <h3>Used by</h3>
        <div v-if="note.attachments.length" class="dependency-list"><span v-for="(attachment, index) in note.attachments" :key="`${attachment.subject}-${attachment.anchor ?? 'whole'}-${index}`"><strong>{{ titleForProcedure(attachment.subject) }}</strong><small v-if="attachment.anchor">Step {{ stepsForProcedure(attachment.subject).find((step) => step.step === attachment.anchor)?.position ?? "" }}</small><small v-else>Whole playbook</small></span></div>
        <p v-else>Not connected to a playbook yet.</p>
        <details v-if="canEdit && activeProcedures.length" class="secondary-disclosure"><summary>Attach to another playbook</summary><form class="attach-form" @submit.prevent="attachContext(note)"><label class="sr-only" :for="`procedure-for-${note.context}`">Choose a playbook</label><select :id="`procedure-for-${note.context}`" v-model="attachmentProcedure[note.context]" required @change="attachmentStep[note.context] = ''"><option value="" disabled>Choose a playbook…</option><option v-for="procedure in activeProcedures" :key="procedure.procedure" :value="procedure.procedure">{{ procedure.title }}</option></select><label class="sr-only" :for="`step-for-${note.context}`">Optional step anchor</label><select :id="`step-for-${note.context}`" v-model="attachmentStep[note.context]" :disabled="!attachmentProcedure[note.context] || !stepsForProcedure(attachmentProcedure[note.context]).length"><option value="">Whole playbook</option><option v-for="step in stepsForProcedure(attachmentProcedure[note.context] ?? '')" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option></select><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !attachmentProcedure[note.context]">{{ actionBusy === `attach-${note.context}` ? "Attaching…" : "Attach" }}</button></form></details>
      </section>

      <div class="context-entry-tools"><button type="button" :aria-expanded="!!questionComposer[note.context]" @click="questionComposer[note.context] = !questionComposer[note.context]">Questions{{ questionsForContext(note.context).length ? ` (${questionsForContext(note.context).length})` : "" }}</button><details v-if="note.changes.length" class="secondary-disclosure history-inline"><summary>Change history ({{ note.changes.length }})</summary><ol class="change-history"><li v-for="change in note.changes" :key="change.change"><div><span>Before</span><p>{{ change.before }}</p></div><div><span>After</span><p>{{ change.after }}</p></div></li></ol></details></div>

      <section v-if="questionComposer[note.context]" class="inline-disclosure">
        <div v-if="questionsForContext(note.context).length" class="subject-question-list"><article v-for="question in questionsForContext(note.context)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }"><strong>{{ question.status === "OPEN" ? "Awaiting answer" : "Answered" }}</strong><p>{{ question.text }}</p><p v-if="question.answer" class="question-answer"><span>Answer</span>{{ question.answer }}</p></article></div>
        <form class="question-form" @submit.prevent="askQuestion(note)"><label :for="`question-${note.context}`">Ask about this context</label><div class="form-row"><input :id="`question-${note.context}`" v-model="questionDraft[note.context]" placeholder="What needs clarification?" required maxlength="1000"><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !activeAttachedProcedure(note) || !(questionDraft[note.context] ?? '').trim()">{{ actionBusy === `ask-context-${note.context}` ? "Sending…" : "Ask" }}</button></div></form><p v-if="!activeAttachedProcedure(note)" class="form-guidance">Attach this note to an active playbook before asking a question.</p>
      </section>
    </article>
  </div>
</template>
