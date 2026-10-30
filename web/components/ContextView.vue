<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import type { Attachment, ContextNote, ContextQuestion, Procedure } from "../api.ts";
import type { ContextChangeResult } from "../context-change-result.ts";
import { meaningfulChangeActionLabel, meaningfulChangeConsequence, questionActionLabel } from "../interaction-guidance.ts";
import { hasChangedDraft, hasMeaningfulDraft, shouldConfirmDiscard } from "../unsaved-work.ts";
import VersionConflict from "./VersionConflict.vue";

const props = defineProps<{ contexts: ContextNote[]; procedures: Procedure[]; contextQuestions: ContextQuestion[]; actionBusy: string; canEdit: boolean; canAnswer: boolean; currentUserId: string; changeResult?: ContextChangeResult }>();
const emit = defineEmits<{
  record: [payload: { text: string; onSuccess: () => void }];
  attach: [payload: { note: ContextNote; procedure: string; step: string; onSuccess: () => void }];
  detach: [payload: { note: ContextNote; attachment: Attachment }];
  deleteNote: [note: ContextNote];
  correct: [payload: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }];
  change: [payload: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }];
  askQuestion: [payload: { note: ContextNote; procedure: string; text: string; onSuccess: () => void }];
  answerQuestion: [payload: { kind: "context"; question: ContextQuestion; answer: string; expectedVersion: number; onSuccess: () => void }];
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
const attachmentComposer = reactive<Record<string, boolean>>({});
const expandedNote = reactive<Record<string, boolean>>({});
const expandedAnswer = reactive<Record<string, boolean>>({});
const expandedHistory = reactive<Record<string, boolean>>({});
const answerDraft = reactive<Record<string, string>>({});
const answerFormOpen = reactive<Record<string, boolean>>({});
const askFormOpen = reactive<Record<string, boolean>>({});

function submitAnswer(question: ContextQuestion) {
  const answer = (answerDraft[question.question] ?? "").trim();
  if (!answer) return;
  emit("answerQuestion", { kind: "context", question, answer, expectedVersion: question.version, onSuccess: () => { answerDraft[question.question] = ""; answerFormOpen[question.question] = false; } });
}
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
function isAttachedTo(note: ContextNote, procedure: string, step = "") {
  return note.attachments.some(({ subject, anchor }) => subject === procedure && (anchor ?? "") === step);
}
function procedureHasAvailableTarget(note: ContextNote, procedure: Procedure) {
  return !isAttachedTo(note, procedure.procedure) || procedure.steps.some(({ step }) => !isAttachedTo(note, procedure.procedure, step));
}
function attachmentTargetAlreadyUsed(note: ContextNote) {
  const procedure = attachmentProcedure[note.context] ?? "";
  return !!procedure && isAttachedTo(note, procedure, attachmentStep[note.context] ?? "");
}
function selectAttachmentProcedure(note: ContextNote) {
  const procedure = activeProcedures.value.find(({ procedure: id }) => id === attachmentProcedure[note.context]);
  if (!procedure) { attachmentStep[note.context] = ""; return; }
  attachmentStep[note.context] = !isAttachedTo(note, procedure.procedure)
    ? ""
    : procedure.steps.find(({ step }) => !isAttachedTo(note, procedure.procedure, step))?.step ?? "";
}
function openUpdate(note: ContextNote) {
  updateOpen.value = note.context;
  updateMode[note.context] ??= "correct";
  correctionDraft[note.context] = note.text;
  changeDraft[note.context] = note.text;
  updateVersion[note.context] = note.version;
}
function closeOtherDisclosures(note: ContextNote, next: "edit" | "attach" | "question") {
  const editingAnother = !!updateOpen.value && (updateOpen.value !== note.context || next !== "edit");
  if (editingAnother && activeUpdateIsDirty.value && !window.confirm("Discard the unsaved Context edit before opening another action?")) return false;
  const openQuestion = Object.keys(questionComposer).find((context) => questionComposer[context] && (context !== note.context || next !== "question"));
  if (openQuestion && (questionDraft[openQuestion] ?? "").trim() && !window.confirm("Keep this unsent question as a draft and open another action?")) return false;
  if (editingAnother) updateOpen.value = "";
  for (const context of Object.keys(questionComposer)) questionComposer[context] = context === note.context && next === "question";
  for (const context of Object.keys(attachmentComposer)) attachmentComposer[context] = context === note.context && next === "attach";
  return true;
}
function toggleUpdate(note: ContextNote) {
  if (updateOpen.value === note.context) {
    if (shouldConfirmDiscard(activeUpdateIsDirty.value, true) && !window.confirm("Discard this unsaved Context edit?")) return;
    updateOpen.value = "";
    return;
  }
  if (!closeOtherDisclosures(note, "edit")) return;
  openUpdate(note);
}
function toggleQuestion(note: ContextNote) {
  if (questionComposer[note.context]) { questionComposer[note.context] = false; return; }
  if (!closeOtherDisclosures(note, "question")) return;
  questionComposer[note.context] = true;
}
function toggleAttachment(note: ContextNote) {
  if (attachmentComposer[note.context]) { attachmentComposer[note.context] = false; return; }
  if (!closeOtherDisclosures(note, "attach")) return;
  attachmentComposer[note.context] = true;
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
  if (isAttachedTo(note, procedure, step)) { emit("validationError", "That Context Note is already attached to the selected target."); return; }
  emit("attach", { note, procedure, step, onSuccess: () => { attachmentProcedure[note.context] = ""; attachmentStep[note.context] = ""; attachmentComposer[note.context] = false; } });
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
function looksLikeMeaningfulChange(original: string, draft: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const a = normalize(original).split(" ");
  const b = normalize(draft).split(" ");
  const added = b.filter((w) => !a.includes(w));
  const removed = a.filter((w) => !b.includes(w));
  return added.length + removed.length > 3;
}
function submitEdit(note: ContextNote) {
  if (updateMode[note.context] === "correct") {
    const draft = (correctionDraft[note.context] ?? "").trim();
    if (draft && looksLikeMeaningfulChange(note.text, draft) && affectedActivePlaybookCount(note) > 0) {
      if (!confirm("This looks like a meaningful change, but you selected \"Fix wording\" — no Reviews will be created. Continue as wording fix?")) return;
    }
    correctContext(note);
  } else {
    changeContext(note);
  }
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
function autoresize(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
function autoresizeEl(el: unknown) {
  if (!(el instanceof HTMLTextAreaElement)) return;
  requestAnimationFrame(() => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; });
}
</script>

<template>
  <header class="page-heading heading-with-action">
    <h1>Shared context</h1>
    <button v-if="canEdit && contexts.length" class="button button-primary" type="button" @click="toggleRecord">{{ showRecord ? "Close" : "New note" }}</button>
  </header>

  <form v-if="canEdit && showRecord" class="disclosure-form create-disclosure context-create-form" @submit.prevent="recordContext">
    <label for="new-context">Context note</label>
    <textarea id="new-context" v-model="contextDraft" class="autoresize" placeholder="What will future members need to know?" required maxlength="4000" rows="2" @input="autoresize"></textarea>
    <div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !contextDraft.trim()">{{ actionBusy === "record-context" ? "Saving…" : "Save note" }}</button></div>
  </form>

  <div v-if="!contexts.length" class="empty-page-state"><h2>Add context when it helps</h2><p>Notes are optional. Use them for decisions or constraints people may question later.</p><button v-if="canEdit && !showRecord" class="button button-primary" type="button" @click="showRecord = true">Add a note</button></div>

  <div v-else class="context-ledger">
    <article v-for="note in contexts" :key="note.context" class="context-entry context-entry-themed">

      <!-- Default reading view: note text with right-aligned icon-actions -->
      <div v-if="updateOpen !== note.context" class="context-entry-row">
        <div class="context-entry-content">
          <p class="context-current-text" :class="{ 'is-collapsed': note.text.length > 420 && !expandedNote[note.context] }">{{ note.text }}</p>
          <button v-if="note.text.length > 420" class="note-read-toggle" type="button" :aria-expanded="!!expandedNote[note.context]" @click="expandedNote[note.context] = !expandedNote[note.context]">{{ expandedNote[note.context] ? "Show less" : "Read more" }}</button>
          <div class="context-meta-row">
            <span v-if="attachmentPlaybookCount(note)" class="context-usage-count">
              <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 3h10v14H5z"/><path d="M8 7h4M8 10h4M8 13h4"/></svg>
              {{ attachmentPlaybookCount(note) }} {{ attachmentPlaybookCount(note) === 1 ? "playbook" : "playbooks" }}
            </span>
            <button v-if="note.changes.length" class="context-change-count" type="button" @click="expandedHistory[note.context] = !expandedHistory[note.context]" :aria-expanded="!!expandedHistory[note.context]">{{ note.changes.length }} {{ note.changes.length === 1 ? "change" : "changes" }}</button>
          </div>
        </div>
        <div class="context-entry-icons">
          <button v-if="canEdit" class="context-icon-button" type="button" title="Edit" :aria-label="`Edit Context Note`" @click="toggleUpdate(note)">
            <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 14.8.6-3.4L13 3l4 4-8.4 8.4-3.4.6Z"/><path d="m11.8 4.2 4 4"/></svg>
          </button>
          <button class="context-icon-button context-icon-question" type="button" title="Questions" :aria-label="contextQuestionLabel(note.context)" :aria-expanded="!!questionComposer[note.context]" :class="{ active: questionComposer[note.context] }" @click="toggleQuestion(note)">
            <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M7 7a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.1-1.5 2.4"/><circle cx="10" cy="15" r=".8" fill="currentColor" stroke="none"/></svg>
            <span v-if="questionsForContext(note.context).length" class="context-icon-badge">{{ questionsForContext(note.context).length }}</span>
          </button>
          <button v-if="canEdit && activeProcedures.length" class="context-icon-button" type="button" title="Attach to playbook" :aria-label="`Attach Context Note`" :aria-expanded="!!attachmentComposer[note.context]" :class="{ active: attachmentComposer[note.context] }" @click="toggleAttachment(note)">
            <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M8 12l4-4M6.5 9.5l-2 2a2.83 2.83 0 0 0 4 4l2-2M13.5 10.5l2-2a2.83 2.83 0 0 0-4-4l-2 2"/></svg>
          </button>
          <details v-if="canEdit" class="context-more-disclosure">
            <summary title="More actions" :aria-label="`More actions for Context Note`">
              <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="4" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="16" cy="10" r="1.2"/></svg>
            </summary>
            <div class="context-more-actions">
              <button class="context-delete-action" type="button" :disabled="!!actionBusy" @click="emit('deleteNote', note)">{{ actionBusy === `delete-context-${note.context}` ? "Deleting…" : "Delete forever" }}</button>
            </div>
          </details>
        </div>
      </div>

      <!-- Change history timeline -->
      <div v-if="expandedHistory[note.context] && note.changes.length" class="context-change-history">
        <div v-for="(change, i) in note.changes" :key="change.change" class="change-history-entry">
          <div class="change-history-marker"><span class="change-history-dot"></span><span v-if="i < note.changes.length - 1" class="change-history-line"></span></div>
          <div class="change-history-content">
            <small class="change-history-date">{{ formatChangeTimestamp(change.occurredAt) }}<span class="change-history-kind" :class="change.kind === 'correction' ? 'kind-correction' : 'kind-change'">{{ change.kind === "correction" ? "Fix wording" : "Information changed" }}</span></small>
            <p class="change-history-before">{{ change.before }}</p>
            <p class="change-history-after">{{ change.after }}</p>
          </div>
        </div>
      </div>

      <!-- Inline editing -->
      <section v-if="updateOpen === note.context" class="context-inline-editor">
        <div class="context-edit-help">
          <button type="button" class="context-help-trigger" aria-label="How this edit works" tabindex="0"><span aria-hidden="true">?</span></button>
          <div class="context-help-popover" role="tooltip">
            <p v-if="attachmentPlaybookCount(note)"><strong>Used in {{ attachmentPlaybookCount(note) }} {{ attachmentPlaybookCount(note) === 1 ? "Playbook" : "Playbooks" }}.</strong></p>
            <p><strong>Fix wording:</strong> corrects spelling or phrasing — no Reviews created.</p>
            <p><strong>Information changed:</strong> records the change and flags affected Playbooks for Review.</p>
          </div>
        </div>
        <form class="context-note-editor" @submit.prevent="submitEdit(note)">
          <label class="sr-only" :for="`edit-${note.context}`">Revised Context Note</label>
          <textarea v-if="updateMode[note.context] === 'change'" :id="`edit-${note.context}`" :ref="autoresizeEl" v-model="changeDraft[note.context]" class="autoresize" required maxlength="4000" rows="1" @input="autoresize"></textarea>
          <textarea v-else :id="`edit-${note.context}`" :ref="autoresizeEl" v-model="correctionDraft[note.context]" class="autoresize" required maxlength="4000" rows="1" @input="autoresize"></textarea>
          <div class="edit-type-chooser">
            <label :class="{ active: updateMode[note.context] === 'correct' }"><input v-model="updateMode[note.context]" type="radio" value="correct">Fix wording</label>
            <label :class="{ active: updateMode[note.context] === 'change' }"><input v-model="updateMode[note.context]" type="radio" value="change">Information changed</label>
          </div>
          <p v-if="updateMode[note.context] === 'change' && hasChangedDraft(note.text, [changeDraft[note.context]])" class="form-guidance pending-guidance">{{ meaningfulChangeConsequence(affectedActivePlaybookCount(note)) }}</p>
          <div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(updateMode[note.context] === 'change' ? changeDraft[note.context] : correctionDraft[note.context] ?? '').trim() || !hasChangedDraft(note.text, [updateMode[note.context] === 'change' ? changeDraft[note.context] : correctionDraft[note.context]])">{{ updateMode[note.context] === "change" && hasChangedDraft(note.text, [changeDraft[note.context]]) ? meaningfulChangeActionLabel(affectedActivePlaybookCount(note)) : "Save wording" }}</button><button class="button button-small button-quiet" type="button" @click="toggleUpdate(note)">Cancel</button></div>
          <VersionConflict v-if="updateVersion[note.context] !== note.version" subject="context note" saved-label="Current saved note" :saved-value="note.text" draft-label="Your unsaved edit" :draft-value="(updateMode[note.context] === 'change' ? changeDraft[note.context] : correctionDraft[note.context]) ?? ''" :busy="!!actionBusy" @use-saved="useSavedContext(note)" @save-mine="saveMyContext(note)" />
        </form>
      </section>

      <!-- Attach disclosure: focused playbook/step picker -->
      <section v-if="attachmentComposer[note.context]" class="context-attach-panel" :aria-label="`Attach Context Note`">
        <form class="attach-form" @submit.prevent="attachContext(note)">
          <label class="sr-only" :for="`procedure-for-${note.context}`">Choose a playbook</label>
          <select :id="`procedure-for-${note.context}`" v-model="attachmentProcedure[note.context]" required @change="selectAttachmentProcedure(note)">
            <option value="" disabled>Choose a playbook…</option>
            <option v-for="procedure in activeProcedures" :key="procedure.procedure" :value="procedure.procedure" :disabled="!procedureHasAvailableTarget(note, procedure)">{{ procedure.title }}{{ procedureHasAvailableTarget(note, procedure) ? "" : " · already attached everywhere" }}</option>
          </select>
          <label class="sr-only" :for="`step-for-${note.context}`">Optional step anchor</label>
          <select :id="`step-for-${note.context}`" v-model="attachmentStep[note.context]" :disabled="!attachmentProcedure[note.context] || !stepsForProcedure(attachmentProcedure[note.context]).length">
            <option value="" :disabled="isAttachedTo(note, attachmentProcedure[note.context] ?? '')">Whole playbook{{ isAttachedTo(note, attachmentProcedure[note.context] ?? '') ? " · already attached" : "" }}</option>
            <option v-for="step in stepsForProcedure(attachmentProcedure[note.context] ?? '')" :key="step.step" :value="step.step" :disabled="isAttachedTo(note, attachmentProcedure[note.context] ?? '', step.step)">Step {{ step.position }} · {{ step.text }}{{ isAttachedTo(note, attachmentProcedure[note.context] ?? '', step.step) ? " · already attached" : "" }}</option>
          </select>
          <button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !attachmentProcedure[note.context] || attachmentTargetAlreadyUsed(note)">{{ actionBusy === `attach-${note.context}` ? "Attaching…" : "Attach" }}</button>
        </form>
        <!-- Existing dependencies -->
        <div v-if="attachmentPlaybookCount(note)" class="context-dependency-summary">
          <details class="context-dependencies">
            <summary>Currently in <strong>{{ attachmentPlaybookCount(note) }}</strong> {{ attachmentPlaybookCount(note) === 1 ? "playbook" : "playbooks" }}</summary>
            <section aria-label="Playbook dependencies"><div class="dependency-list"><span v-for="attachment in note.attachments" :key="attachment.attachment"><strong>{{ titleForProcedure(attachment.subject) }}</strong><small v-if="attachment.anchor">Step {{ stepsForProcedure(attachment.subject).find((step) => step.step === attachment.anchor)?.position ?? "" }}</small><small v-else>Whole playbook</small><button v-if="canEdit && activeProcedures.some(({ procedure }) => procedure === attachment.subject)" class="dependency-remove" type="button" :disabled="!!actionBusy" :aria-label="`Remove context from ${titleForProcedure(attachment.subject)}${attachment.anchor ? ' step' : ''}`" @click="emit('detach', { note, attachment })">{{ attachment.anchor ? "Remove from Step" : "Remove from Playbook" }}</button></span></div></section>
          </details>
        </div>
      </section>

      <!-- Questions: compact inline cards -->
      <section v-if="questionComposer[note.context]" class="context-question-panel">
        <div v-if="questionsForContext(note.context).length" class="context-question-list">
          <article v-for="question in questionsForContext(note.context)" :key="question.question" class="context-q-card" :aria-label="question.status === 'OPEN' ? 'Open question' : 'Answered question'">
            <div class="context-q-row">
              <span class="context-q-badge" :class="question.status === 'OPEN' ? 'badge-pending' : ''">Q</span>
              <p class="context-q-text">{{ question.text }}</p>
              <small v-if="question.status === 'OPEN'" class="context-q-status pending">Awaiting answer</small>
              <small v-else class="context-q-status">Answered</small>
              <button v-if="question.answer" class="conversation-toggle-action" type="button" :aria-expanded="!!expandedAnswer[question.question]" :title="expandedAnswer[question.question] ? 'Hide answer' : 'Show answer'" @click="expandedAnswer[question.question] = !expandedAnswer[question.question]">
                <svg aria-hidden="true" viewBox="0 0 20 20" :style="expandedAnswer[question.question] ? 'transform: rotate(180deg)' : ''"><path d="M5 8l5 5 5-5"/></svg>
              </button>
            </div>
            <div v-if="question.answer && expandedAnswer[question.question]" class="context-q-answer">
              <span class="context-q-badge">A</span>
              <p>{{ question.answer }}</p>
            </div>
            <div v-if="question.status === 'OPEN' && canAnswer && !answerFormOpen[question.question]" class="context-q-answer-prompt">
              <button class="text-button context-answer-link" type="button" @click="answerFormOpen[question.question] = true">Answer this question</button>
            </div>
            <form v-if="question.status === 'OPEN' && answerFormOpen[question.question]" class="context-q-answer-form" @submit.prevent="submitAnswer(question)">
              <textarea v-model="answerDraft[question.question]" placeholder="Write your answer…" required maxlength="4000" rows="1" class="autoresize" @input="autoresize"></textarea>
              <div class="form-actions"><button class="button button-small button-quiet" type="button" @click="answerFormOpen[question.question] = false; answerDraft[question.question] = ''">Cancel</button><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(answerDraft[question.question] ?? '').trim()">{{ actionBusy === `answer-context-${question.question}` ? "Saving…" : "Submit answer" }}</button></div>
            </form>
          </article>
        </div>
        <button v-if="activeAttachedProcedure(note) && !askFormOpen[note.context] && !questionsForContext(note.context).some((q) => answerFormOpen[q.question])" class="text-button context-ask-link" type="button" @click="askFormOpen[note.context] = true">+ Ask another question</button>
        <form v-if="activeAttachedProcedure(note) && askFormOpen[note.context]" class="context-ask-form" @submit.prevent="askQuestion(note)">
          <div class="form-row">
            <input :id="`question-${note.context}`" v-model="questionDraft[note.context]" placeholder="What needs clarification?" required maxlength="1000">
            <button class="button button-small button-quiet" type="button" @click="askFormOpen[note.context] = false">Cancel</button>
            <button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(questionDraft[note.context] ?? '').trim()">{{ actionBusy === `ask-context-${note.context}` ? "Sending…" : "Ask" }}</button>
          </div>
        </form>
        <p v-else-if="!activeAttachedProcedure(note)" class="form-guidance">This note must be attached to an active Playbook before a new Question can be asked.</p>
      </section>

      <!-- Change result banner -->
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
