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
const expandedNote = reactive<Record<string, boolean>>({});
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
function attachmentPlaybookCount(note: ContextNote) { return new Set(note.attachments.map(({ subject }) => subject)).size; }
function affectedActivePlaybookCount(note: ContextNote) { return new Set(note.attachments.map(({ subject }) => subject).filter((subject) => activeProcedures.value.some(({ procedure }) => procedure === subject))).size; }
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
    <h1>Shared context</h1>
    <button v-if="canEdit && contexts.length" class="button button-primary" type="button" @click="showRecord = !showRecord">{{ showRecord ? "Close" : "New note" }}</button>
  </header>

  <form v-if="canEdit && showRecord" class="disclosure-form create-disclosure" @submit.prevent="recordContext">
    <label for="new-context">Context note</label>
    <textarea id="new-context" v-model="contextDraft" placeholder="What will future members need to know?" required maxlength="4000" rows="4"></textarea>
    <div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !contextDraft.trim()">{{ actionBusy === "record-context" ? "Saving…" : "Save note" }}</button></div>
  </form>

  <div v-if="!contexts.length" class="empty-page-state"><h2>Add context when it helps</h2><p>Notes are optional. Use them for decisions or constraints people may question later.</p><button v-if="canEdit && !showRecord" class="button button-primary" type="button" @click="showRecord = true">Add a note</button></div>

  <div v-else class="context-ledger">
    <article v-for="note in contexts" :key="note.context" class="context-entry">
      <header class="context-entry-header">
        <div><p class="context-current-text" :class="{ 'is-collapsed': note.text.length > 420 && !expandedNote[note.context] }">{{ note.text }}</p><button v-if="note.text.length > 420" class="note-read-toggle" type="button" :aria-expanded="!!expandedNote[note.context]" @click="expandedNote[note.context] = !expandedNote[note.context]">{{ expandedNote[note.context] ? "Show less" : "Read more" }}</button></div>
        <button v-if="canEdit" class="button button-small button-secondary" type="button" @click="updateOpen === note.context ? updateOpen = '' : openUpdate(note)">{{ updateOpen === note.context ? "Close" : "Update" }}</button>
      </header>

      <section v-if="updateOpen === note.context" class="update-disclosure">
        <fieldset>
          <legend>What changed?</legend>
          <label><input v-model="updateMode[note.context]" type="radio" value="correct"> <span><strong>Fix wording</strong><small>For typos or clearer phrasing. No Review.</small></span></label>
          <label><input v-model="updateMode[note.context]" type="radio" value="change"> <span><strong>Information changed</strong><small>Keeps both versions and may create Reviews.</small></span></label>
        </fieldset>
        <form v-if="updateMode[note.context] === 'correct'" @submit.prevent="correctContext(note)"><label :for="`correct-${note.context}`">Revised note</label><textarea :id="`correct-${note.context}`" v-model="correctionDraft[note.context]" required maxlength="4000" rows="3"></textarea><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(correctionDraft[note.context] ?? '').trim()">Save wording</button></div></form>
        <form v-else @submit.prevent="changeContext(note)"><label :for="`change-${note.context}`">New information</label><textarea :id="`change-${note.context}`" v-model="changeDraft[note.context]" required maxlength="4000" rows="3"></textarea><p class="form-guidance pending-guidance"><template v-if="affectedActivePlaybookCount(note)">This will create or update {{ affectedActivePlaybookCount(note) }} {{ affectedActivePlaybookCount(note) === 1 ? "playbook review" : "playbook reviews" }}.</template><template v-else>No active playbooks are attached, so this will not create a review.</template></p><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(changeDraft[note.context] ?? '').trim()">{{ actionBusy === `change-${note.context}` ? "Saving…" : "Save change" }}</button></div></form>
      </section>

      <details class="secondary-disclosure context-dependencies"><summary>Used by {{ attachmentPlaybookCount(note) }} {{ attachmentPlaybookCount(note) === 1 ? "playbook" : "playbooks" }}</summary><section aria-label="Playbook dependencies"><div v-if="note.attachments.length" class="dependency-list"><span v-for="(attachment, index) in note.attachments" :key="`${attachment.subject}-${attachment.anchor ?? 'whole'}-${index}`"><strong>{{ titleForProcedure(attachment.subject) }}</strong><small v-if="attachment.anchor">Step {{ stepsForProcedure(attachment.subject).find((step) => step.step === attachment.anchor)?.position ?? "" }}</small><small v-else>Whole playbook</small></span></div><p v-else>Not connected yet.</p><form v-if="canEdit && activeProcedures.length" class="attach-form" @submit.prevent="attachContext(note)"><label class="sr-only" :for="`procedure-for-${note.context}`">Choose a playbook</label><select :id="`procedure-for-${note.context}`" v-model="attachmentProcedure[note.context]" required @change="attachmentStep[note.context] = ''"><option value="" disabled>Choose a playbook…</option><option v-for="procedure in activeProcedures" :key="procedure.procedure" :value="procedure.procedure">{{ procedure.title }}</option></select><label class="sr-only" :for="`step-for-${note.context}`">Optional step anchor</label><select :id="`step-for-${note.context}`" v-model="attachmentStep[note.context]" :disabled="!attachmentProcedure[note.context] || !stepsForProcedure(attachmentProcedure[note.context]).length"><option value="">Whole playbook</option><option v-for="step in stepsForProcedure(attachmentProcedure[note.context] ?? '')" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option></select><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !attachmentProcedure[note.context]">{{ actionBusy === `attach-${note.context}` ? "Attaching…" : "Attach" }}</button></form></section></details>

      <div class="context-entry-tools"><button type="button" :aria-expanded="!!questionComposer[note.context]" @click="questionComposer[note.context] = !questionComposer[note.context]">Questions{{ questionsForContext(note.context).length ? ` (${questionsForContext(note.context).length})` : "" }}</button><details v-if="note.changes.length" class="secondary-disclosure history-inline"><summary>Change history ({{ note.changes.length }})</summary><ol class="change-history"><li v-for="change in note.changes" :key="change.change"><div><span>Before</span><p>{{ change.before }}</p></div><div><span>After</span><p>{{ change.after }}</p></div></li></ol></details></div>

      <section v-if="questionComposer[note.context]" class="inline-disclosure">
        <div v-if="questionsForContext(note.context).length" class="subject-question-list"><article v-for="question in questionsForContext(note.context)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }"><strong>{{ question.status === "OPEN" ? "Awaiting answer" : "Answered" }}</strong><p>{{ question.text }}</p><p v-if="question.answer" class="question-answer"><span>Answer</span>{{ question.answer }}</p></article></div>
        <form class="question-form" @submit.prevent="askQuestion(note)"><label :for="`question-${note.context}`">Ask about this context</label><div class="form-row"><input :id="`question-${note.context}`" v-model="questionDraft[note.context]" placeholder="What needs clarification?" required maxlength="1000"><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !activeAttachedProcedure(note) || !(questionDraft[note.context] ?? '').trim()">{{ actionBusy === `ask-context-${note.context}` ? "Sending…" : "Ask" }}</button></div></form><p v-if="!activeAttachedProcedure(note)" class="form-guidance">Attach this note to an active playbook before asking a question.</p>
      </section>
    </article>
  </div>
</template>
