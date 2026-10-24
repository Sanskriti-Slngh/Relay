<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import type { Attachment, ContextNote, ContextQuestion, Procedure } from "../api.ts";
import type { ContextChangeResult } from "../context-change-result.ts";
import { meaningfulChangeActionLabel, meaningfulChangeConsequence, questionActionLabel } from "../interaction-guidance.ts";
import { hasChangedDraft, hasMeaningfulDraft, shouldConfirmDiscard } from "../unsaved-work.ts";
import VersionConflict from "./VersionConflict.vue";

const props = defineProps<{ contexts: ContextNote[]; procedures: Procedure[]; contextQuestions: ContextQuestion[]; actionBusy: string; canEdit: boolean; changeResult?: ContextChangeResult }>();
const emit = defineEmits<{
  record: [payload: { text: string; onSuccess: () => void }];
  attach: [payload: { note: ContextNote; procedure: string; step: string; onSuccess: () => void }];
  detach: [payload: { note: ContextNote; attachment: Attachment }];
  deleteNote: [note: ContextNote];
  correct: [payload: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }];
  change: [payload: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }];
  askQuestion: [payload: { note: ContextNote; procedure: string; text: string; onSuccess: () => void }];
  validationError: [message: string];
  reviewAffected: [review: string];
  dismissChangeResult: [];
  dirtyChange: [dirty: boolean];
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
const updateVersion = reactive<Record<string, number>>({});
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const activeUpdateIsDirty = computed(() => {
  const note = props.contexts.find(({ context }) => context === updateOpen.value);
  if (!note) return false;
  return hasChangedDraft(note.text, [correctionDraft[note.context], changeDraft[note.context]]);
});
const hasUnsavedWork = computed(() =>
  !!contextDraft.value.trim() || activeUpdateIsDirty.value || hasMeaningfulDraft(Object.values(questionDraft)),
);

watch(hasUnsavedWork, (dirty) => emit("dirtyChange", dirty), { immediate: true });
onUnmounted(() => emit("dirtyChange", false));

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
function contextQuestionLabel(id: string) { return questionActionLabel(questionsForContext(id).length); }
function formatChangeTimestamp(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function attachmentPlaybookCount(note: ContextNote) { return new Set(note.attachments.map(({ subject }) => subject)).size; }
function affectedActivePlaybookCount(note: ContextNote) { return new Set(note.attachments.map(({ subject }) => subject).filter((subject) => activeProcedures.value.some(({ procedure }) => procedure === subject))).size; }
function activeAttachedProcedure(note: ContextNote) { return note.attachments.map(({ subject }) => subject).find((subject) => activeProcedures.value.some(({ procedure }) => procedure === subject)); }
function openUpdate(note: ContextNote) {
  updateOpen.value = note.context;
  updateMode[note.context] ??= "correct";
  correctionDraft[note.context] = note.text;
  changeDraft[note.context] = note.text;
  updateVersion[note.context] = note.version;
}
function toggleUpdate(note: ContextNote) {
  if (shouldConfirmDiscard(activeUpdateIsDirty.value, !!updateOpen.value && updateOpen.value !== note.context) && !window.confirm("Discard the unsaved Context edit before editing another Note?")) return;
  if (updateOpen.value === note.context) {
    if (shouldConfirmDiscard(activeUpdateIsDirty.value, true) && !window.confirm("Discard this unsaved Context edit?")) return;
    updateOpen.value = "";
    return;
  }
  openUpdate(note);
}
function toggleRecord() {
  if (showRecord.value) {
    if (contextDraft.value.trim() && !window.confirm("Discard this unsaved Context Note?")) return;
    contextDraft.value = "";
  }
  showRecord.value = !showRecord.value;
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
  emit("correct", { note, text, expectedVersion: updateVersion[note.context] ?? note.version, onSuccess: () => { correctionDraft[note.context] = ""; delete updateVersion[note.context]; updateOpen.value = ""; } });
}
function changeContext(note: ContextNote) {
  const text = (changeDraft[note.context] ?? "").trim(); if (!text) return;
  if (text === note.text) { emit("validationError", "A meaningful change must differ from the current note."); return; }
  emit("change", { note, text, expectedVersion: updateVersion[note.context] ?? note.version, onSuccess: () => { changeDraft[note.context] = ""; delete updateVersion[note.context]; updateOpen.value = ""; } });
}
function useSavedContext(note: ContextNote) {
  delete correctionDraft[note.context]; delete changeDraft[note.context]; delete updateVersion[note.context]; updateOpen.value = "";
}
function saveMyContext(note: ContextNote) {
  updateVersion[note.context] = note.version;
  if (updateMode[note.context] === "change") changeContext(note); else correctContext(note);
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
    <button v-if="canEdit && contexts.length" class="button button-primary" type="button" @click="toggleRecord">{{ showRecord ? "Close" : "New note" }}</button>
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
        <div class="context-entry-content">
          <p class="context-current-text" :class="{ 'is-collapsed': note.text.length > 420 && !expandedNote[note.context] }">{{ note.text }}</p>
          <button v-if="note.text.length > 420" class="note-read-toggle" type="button" :aria-expanded="!!expandedNote[note.context]" @click="expandedNote[note.context] = !expandedNote[note.context]">{{ expandedNote[note.context] ? "Show less" : "Read more" }}</button>
          <div class="context-card-footer">
            <div v-if="attachmentPlaybookCount(note) || note.changes.length" class="context-info-row" aria-label="Context Note details">
              <details v-if="attachmentPlaybookCount(note)" class="context-dependencies">
                <summary>Used in <strong>{{ attachmentPlaybookCount(note) }}</strong> {{ attachmentPlaybookCount(note) === 1 ? "playbook" : "playbooks" }}</summary>
                <section aria-label="Playbook dependencies"><div class="dependency-list"><span v-for="attachment in note.attachments" :key="attachment.attachment"><strong>{{ titleForProcedure(attachment.subject) }}</strong><small v-if="attachment.anchor">Step {{ stepsForProcedure(attachment.subject).find((step) => step.step === attachment.anchor)?.position ?? "" }}</small><small v-else>Whole playbook</small><button v-if="canEdit && activeProcedures.some(({ procedure }) => procedure === attachment.subject)" class="dependency-remove" type="button" :disabled="!!actionBusy" :aria-label="`Remove context from ${titleForProcedure(attachment.subject)}${attachment.anchor ? ' step' : ''}`" @click="emit('detach', { note, attachment })">{{ attachment.anchor ? "Remove from Step" : "Remove from Playbook" }}</button></span></div></section>
              </details>
              <details v-if="note.changes.length" class="history-inline"><summary>{{ note.changes.length }} {{ note.changes.length === 1 ? "change" : "changes" }}</summary><ol class="change-history"><li v-for="change in note.changes" :key="change.change"><time v-if="change.occurredAt" :datetime="change.occurredAt">{{ formatChangeTimestamp(change.occurredAt) }}</time><div><span>Before</span><p>{{ change.before }}</p></div><div><span>After</span><p>{{ change.after }}</p></div></li></ol></details>
            </div>
            <div class="context-action-row">
              <button type="button" :aria-expanded="!!questionComposer[note.context]" @click="questionComposer[note.context] = !questionComposer[note.context]">{{ contextQuestionLabel(note.context) }}</button>
              <details v-if="canEdit && activeProcedures.length" class="context-attach-disclosure"><summary>Attach</summary><form class="attach-form" @submit.prevent="attachContext(note)"><label class="sr-only" :for="`procedure-for-${note.context}`">Choose a playbook</label><select :id="`procedure-for-${note.context}`" v-model="attachmentProcedure[note.context]" required @change="attachmentStep[note.context] = ''"><option value="" disabled>Choose a playbook…</option><option v-for="procedure in activeProcedures" :key="procedure.procedure" :value="procedure.procedure">{{ procedure.title }}</option></select><label class="sr-only" :for="`step-for-${note.context}`">Optional step anchor</label><select :id="`step-for-${note.context}`" v-model="attachmentStep[note.context]" :disabled="!attachmentProcedure[note.context] || !stepsForProcedure(attachmentProcedure[note.context]).length"><option value="">Whole playbook</option><option v-for="step in stepsForProcedure(attachmentProcedure[note.context] ?? '')" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option></select><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !attachmentProcedure[note.context]">{{ actionBusy === `attach-${note.context}` ? "Attaching…" : "Attach" }}</button></form></details>
            </div>
          </div>
        </div>
        <div v-if="canEdit" class="context-header-actions"><button class="context-edit-action" type="button" @click="toggleUpdate(note)">{{ updateOpen === note.context ? "Close" : "Edit" }}</button><button class="context-delete-icon" type="button" :disabled="!!actionBusy" aria-label="Delete Context Note forever" title="Delete Context Note forever" @click="emit('deleteNote', note)">{{ actionBusy === `delete-context-${note.context}` ? "…" : "×" }}</button></div>
      </header>

      <section v-if="questionComposer[note.context]" class="inline-disclosure context-question-disclosure">
        <div v-if="questionsForContext(note.context).length" class="subject-question-list"><article v-for="question in questionsForContext(note.context)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }"><strong>{{ question.status === "OPEN" ? "Awaiting answer" : "Answered" }}</strong><p>{{ question.text }}</p><p v-if="question.answer" class="question-answer"><span>Answer</span>{{ question.answer }}</p></article></div>
        <form class="question-form" @submit.prevent="askQuestion(note)"><label :for="`question-${note.context}`">Ask about this context</label><div class="form-row"><input :id="`question-${note.context}`" v-model="questionDraft[note.context]" placeholder="What needs clarification?" required maxlength="1000"><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !activeAttachedProcedure(note) || !(questionDraft[note.context] ?? '').trim()">{{ actionBusy === `ask-context-${note.context}` ? "Sending…" : "Ask" }}</button></div></form><p v-if="!activeAttachedProcedure(note)" class="form-guidance">Attach this note to an active playbook before asking a question.</p>
      </section>

      <section v-if="updateOpen === note.context" class="update-disclosure">
        <fieldset>
          <legend>What changed?</legend>
          <label class="context-change-option" :class="{ selected: updateMode[note.context] === 'correct' }"><input v-model="updateMode[note.context]" type="radio" value="correct"> <span><strong>Fix wording</strong><small>Change phrasing only. This does not create Review work.</small></span></label>
          <label class="context-change-option meaningful" :class="{ selected: updateMode[note.context] === 'change' }"><input v-model="updateMode[note.context]" type="radio" value="change"> <span><strong>Information changed</strong><small>Record a change in meaning and review every affected Playbook.</small></span></label>
        </fieldset>
        <form v-if="updateMode[note.context] === 'correct'" @submit.prevent="correctContext(note)"><label :for="`correct-${note.context}`">Revised note</label><textarea :id="`correct-${note.context}`" v-model="correctionDraft[note.context]" required maxlength="4000" rows="3"></textarea><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(correctionDraft[note.context] ?? '').trim()">{{ actionBusy === `correct-${note.context}` ? "Saving…" : "Save wording" }}</button></div><VersionConflict v-if="updateVersion[note.context] !== note.version" subject="context note" saved-label="Current saved note" :saved-value="note.text" draft-label="Your unsaved wording" :draft-value="correctionDraft[note.context] ?? ''" :busy="!!actionBusy" @use-saved="useSavedContext(note)" @save-mine="saveMyContext(note)" /></form>
        <form v-else @submit.prevent="changeContext(note)"><label :for="`change-${note.context}`">New information</label><textarea :id="`change-${note.context}`" v-model="changeDraft[note.context]" required maxlength="4000" rows="3"></textarea><p class="form-guidance pending-guidance">{{ meaningfulChangeConsequence(affectedActivePlaybookCount(note)) }}</p><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !(changeDraft[note.context] ?? '').trim()">{{ actionBusy === `change-${note.context}` ? "Saving…" : meaningfulChangeActionLabel(affectedActivePlaybookCount(note)) }}</button></div><VersionConflict v-if="updateVersion[note.context] !== note.version" subject="context note" saved-label="Current saved information" :saved-value="note.text" draft-label="Your unsaved information" :draft-value="changeDraft[note.context] ?? ''" :busy="!!actionBusy" @use-saved="useSavedContext(note)" @save-mine="saveMyContext(note)" /></form>
      </section>

      <section v-if="changeResult?.context === note.context" class="context-change-result">
        <div role="status" aria-live="polite">
          <h3 v-if="changeResult.affectedPlaybooks.length">{{ changeResult.affectedPlaybooks.length }} {{ changeResult.affectedPlaybooks.length === 1 ? "playbook needs" : "playbooks need" }} review</h3>
          <h3 v-else>Information updated</h3>
          <p v-if="changeResult.affectedPlaybooks.length">Affected: {{ changeResult.affectedPlaybooks.map(({ title }) => title).join(", ") }}.</p>
          <p v-else>No active Playbooks required a Review.</p>
        </div>
        <div class="context-result-actions">
          <button v-if="changeResult.affectedPlaybooks.length" class="button button-primary" type="button" @click="emit('reviewAffected', changeResult.affectedPlaybooks[0].review)">Review affected Playbooks</button>
          <button class="button button-quiet" type="button" @click="emit('dismissChangeResult')">Dismiss</button>
        </div>
      </section>

    </article>
  </div>
</template>
