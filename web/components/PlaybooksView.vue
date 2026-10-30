<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import type { Attachment, ContextNote, PendingReview, Procedure, Step, StepQuestion, WorkspaceMember } from "../api.ts";
import { questionActionLabel } from "../interaction-guidance.ts";
import { meaningfulChangeActionLabel, meaningfulChangeConsequence } from "../interaction-guidance.ts";
import { hasChangedDraft, hasMeaningfulDraft, shouldConfirmDiscard } from "../unsaved-work.ts";
import VersionConflict from "./VersionConflict.vue";

const props = defineProps<{ procedures: Procedure[]; contexts: ContextNote[]; stepQuestions: StepQuestion[]; members: WorkspaceMember[]; actionBusy: string; canEdit: boolean; canEditContext: boolean; canRemoveQuestions: boolean; focusProcedure?: string; focusContextStep?: string; startCreate?: boolean; review?: PendingReview }>();
const emit = defineEmits<{
  create: [payload: { title: string; onSuccess: () => void }];
  addStep: [payload: { procedure: Procedure; text: string; expectedVersion: number; onSuccess: () => void }];
  rename: [payload: { procedure: Procedure; title: string; expectedVersion: number; onSuccess: () => void }];
  editStep: [payload: { procedure: Procedure; step: Step; text: string; expectedVersion: number; onSuccess: () => void }];
  moveStep: [payload: { procedure: Procedure; step: Step; position: number }];
  removeStep: [payload: { procedure: Procedure; step: Step }];
  askQuestion: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void }];
  removeQuestion: [payload: { kind: "step"; question: StepQuestion }];
  attachContext: [payload: { note: ContextNote; procedure: Procedure; step: Step; onSuccess: () => void }];
  recordContext: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void; onRecordedOnly: (context: string) => void }];
  detachContext: [payload: { note: ContextNote; attachment: Attachment }];
  correctContext: [payload: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }];
  changeContext: [payload: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }];
  archive: [procedure: Procedure];
  returnToReview: [];
  dirtyChange: [dirty: boolean];
}>();

const procedureTitle = ref("");
const playbookSearch = ref("");
const selectedProcedureId = ref("");
const focusedArchivedId = ref("");
const showCreate = ref(false);
const showAddStep = ref(false);
const stepDraft = reactive<Record<string, string>>({});
const titleDraft = reactive<Record<string, string>>({});
const stepEditDraft = reactive<Record<string, string>>({});
const titleEditVersion = reactive<Record<string, number>>({});
const stepEditVersion = reactive<Record<string, number>>({});
const addStepVersion = reactive<Record<string, number>>({});
const questionDraft = reactive<Record<string, string>>({});
const stepMode = reactive<Record<string, "reading" | "editing" | "questions">>({});
const questionFormOpen = reactive<Record<string, boolean>>({});
const contextComposer = reactive<Record<string, boolean>>({});
const contextMode = reactive<Record<string, "existing" | "new">>({});
const contextSelection = reactive<Record<string, string>>({});
const contextDraft = reactive<Record<string, string>>({});
const editSubmode = reactive<Record<string, "instruction" | "context">>({});
const expandedContext = reactive<Record<string, boolean>>({});
const expandedAnswer = reactive<Record<string, boolean>>({});
const editingContext = ref("");
const contextEditMode = reactive<Record<string, "correct" | "change">>({});
const contextEditDraft = reactive<Record<string, string>>({});
const contextEditVersion = reactive<Record<string, number>>({});
const editingTitle = ref("");
const editingStep = ref("");
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const archivedProcedures = computed(() => props.procedures.filter(({ status }) => status === "RETIRED"));
const filteredProcedures = computed(() => {
  const query = playbookSearch.value.trim().toLocaleLowerCase();
  return query ? activeProcedures.value.filter(({ title }) => title.toLocaleLowerCase().includes(query)) : activeProcedures.value;
});
const selectedProcedure = computed(() => activeProcedures.value.find(({ procedure }) => procedure === selectedProcedureId.value));
const hasUnsavedWork = computed(() => {
  const procedure = selectedProcedure.value;
  const step = procedure?.steps.find(({ step: id }) => id === editingStep.value);
  return !!procedureTitle.value.trim() ||
    (!!procedure && editingTitle.value === procedure.procedure && (titleDraft[procedure.procedure] ?? "") !== procedure.title) ||
    (!!step && (stepEditDraft[step.step] ?? "") !== step.text) ||
    hasMeaningfulDraft(Object.values(stepDraft)) ||
    hasMeaningfulDraft(Object.values(questionDraft)) ||
    hasMeaningfulDraft(Object.values(contextDraft)) ||
    (!!editingContext.value && hasChangedDraft(props.contexts.find(({ context }) => context === editingContext.value)?.text ?? "", [contextEditDraft[editingContext.value]]));
});
const losesDraftOnPlaybookSwitch = computed(() => {
  const procedure = selectedProcedure.value;
  const step = procedure?.steps.find(({ step: id }) => id === editingStep.value);
  return (!!procedure && editingTitle.value === procedure.procedure && (titleDraft[procedure.procedure] ?? "") !== procedure.title) ||
    (!!step && (stepEditDraft[step.step] ?? "") !== step.text) ||
    hasMeaningfulDraft([procedure ? stepDraft[procedure.procedure] : ""]);
});

watch(hasUnsavedWork, (dirty) => emit("dirtyChange", dirty), { immediate: true });
onUnmounted(() => emit("dirtyChange", false));

watch(activeProcedures, (procedures) => {
  if (!procedures.some(({ procedure }) => procedure === selectedProcedureId.value)) selectedProcedureId.value = procedures[0]?.procedure ?? "";
  if (!procedures.length && props.canEdit) showCreate.value = true;
}, { immediate: true });

watch(() => props.focusProcedure, (procedure) => {
  if (!procedure) return;
  if (activeProcedures.value.some(({ procedure: id }) => id === procedure)) {
    selectedProcedureId.value = procedure;
    focusedArchivedId.value = "";
  } else if (archivedProcedures.value.some(({ procedure: id }) => id === procedure)) {
    focusedArchivedId.value = procedure;
  }
}, { immediate: true });

watch(() => props.startCreate, (start) => {
  if (start && props.canEdit) showCreate.value = true;
}, { immediate: true });

watch(() => props.focusContextStep, (step) => {
  if (!step) return;
  contextComposer[step] = true;
  contextMode[step] = "new";
}, { immediate: true });

watch(() => props.procedures, () => {
  if (!editingStep.value) return;
  const refreshed = selectedProcedure.value?.steps.find(({ step }) => step === editingStep.value);
  if (refreshed && stepEditDraft[refreshed.step]?.trim() === refreshed.text) stepEditVersion[refreshed.step] = refreshed.version;
}, { deep: true });

function selectProcedure(procedure: Procedure) {
  if (procedure.procedure === selectedProcedureId.value) return;
  if (shouldConfirmDiscard(losesDraftOnPlaybookSwitch.value, procedure.procedure !== selectedProcedureId.value) && !window.confirm("Discard the unsaved Playbook edit before opening another Playbook?")) return;
  const previous = selectedProcedure.value;
  if (previous) {
    delete titleDraft[previous.procedure];
    delete titleEditVersion[previous.procedure];
    delete stepDraft[previous.procedure];
    delete addStepVersion[previous.procedure];
    if (editingStep.value) {
      delete stepEditDraft[editingStep.value];
      delete stepEditVersion[editingStep.value];
    }
  }
  selectedProcedureId.value = procedure.procedure;
  focusedArchivedId.value = "";
  editingTitle.value = "";
  editingStep.value = "";
  showAddStep.value = false;
}
function notesForProcedure(procedure: Procedure) {
  return props.contexts.filter((note) =>
    note.attachments.some((attachment) => attachment.subject === procedure.procedure && !attachment.anchor));
}
function notesForStep(procedureId: string, stepId: string) { return props.contexts.filter((note) => note.attachments.some((attachment) => attachment.subject === procedureId && attachment.anchor === stepId) && !note.attachments.some((attachment) => attachment.subject === procedureId && !attachment.anchor)); }
function attachmentForStep(note: ContextNote, procedureId: string, stepId: string) { return note.attachments.find((attachment) => attachment.subject === procedureId && attachment.anchor === stepId); }
function attachmentForProcedure(note: ContextNote, procedureId: string) { return note.attachments.find((attachment) => attachment.subject === procedureId && attachment.anchor === null); }
function availableNotesForStep(procedureId: string, stepId: string) { return props.contexts.filter((note) => !note.attachments.some((attachment) => attachment.subject === procedureId && attachment.anchor === stepId)); }
function questionsForStep(step: string) { return props.stepQuestions.filter((question) => question.step === step); }
function stepQuestionLabel(step: string) { return questionActionLabel(questionsForStep(step).length); }
function questionDate(askedAt: string | null | undefined) {
  if (!askedAt) return "";
  const date = new Date(askedAt);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
function answererName(answerer: string | null | undefined) {
  if (!answerer) return "";
  return props.members.find(({ user }) => user === answerer)?.name ?? "Former member";
}
function playbookHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(hash) % 8;
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
function createProcedure() {
  const title = procedureTitle.value.trim(); if (!title) return;
  emit("create", { title, onSuccess: () => { procedureTitle.value = ""; showCreate.value = false; } });
}
function addStep(procedure: Procedure) {
  const text = (stepDraft[procedure.procedure] ?? "").trim(); if (!text) return;
  emit("addStep", { procedure, text, expectedVersion: addStepVersion[procedure.procedure] ?? procedure.version, onSuccess: () => { stepDraft[procedure.procedure] = ""; delete addStepVersion[procedure.procedure]; showAddStep.value = false; } });
}
function beginRename(procedure: Procedure) { titleDraft[procedure.procedure] = procedure.title; titleEditVersion[procedure.procedure] = procedure.version; editingTitle.value = procedure.procedure; }
function cancelRename(procedure: Procedure) { delete titleDraft[procedure.procedure]; delete titleEditVersion[procedure.procedure]; editingTitle.value = ""; }
function renameProcedure(procedure: Procedure) {
  const title = (titleDraft[procedure.procedure] ?? "").trim(); if (!title) return;
  emit("rename", { procedure, title, expectedVersion: titleEditVersion[procedure.procedure] ?? procedure.version, onSuccess: () => { delete titleEditVersion[procedure.procedure]; editingTitle.value = ""; } });
}
function useSavedTitle(procedure: Procedure) { delete titleDraft[procedure.procedure]; delete titleEditVersion[procedure.procedure]; editingTitle.value = ""; }
function saveMyTitle(procedure: Procedure) { titleEditVersion[procedure.procedure] = procedure.version; renameProcedure(procedure); }
function beginEditStep(step: Step) {
  if (stepMode[step.step] === "editing") { cancelEditStep(step); return; }
  const current = selectedProcedure.value?.steps.find(({ step: id }) => id === editingStep.value);
  const dirty = !!current && stepEditorIsDirty(current);
  if (current?.step !== step.step && shouldConfirmDiscard(dirty, true) && !window.confirm("Discard the unsaved Step wording before editing another Step?")) return;
  if (current?.step !== step.step && current) discardStepEditor(current);
  stepEditDraft[step.step] = step.text; stepEditVersion[step.step] = step.version; editingStep.value = step.step;
  stepMode[step.step] = "editing";
  editSubmode[step.step] = "instruction";
}
function editStep(procedure: Procedure, step: Step) {
  const text = (stepEditDraft[step.step] ?? "").trim(); if (!text) return;
  const context = props.contexts.find(({ context }) => context === editingContext.value);
  const keepEditor = (!!context && hasChangedDraft(context.text, [contextEditDraft[context.context]])) || !!(contextDraft[step.step] ?? "").trim();
  emit("editStep", { procedure, step, text, expectedVersion: stepEditVersion[step.step] ?? step.version, onSuccess: () => {
    if (keepEditor) { stepEditDraft[step.step] = text; return; }
    delete stepEditDraft[step.step]; delete stepEditVersion[step.step]; editingStep.value = ""; stepMode[step.step] = "reading";
  } });
}
function stepEditorIsDirty(step: Step) {
  const context = props.contexts.find(({ context }) => context === editingContext.value);
  return hasChangedDraft(step.text, [stepEditDraft[step.step]]) ||
    (!!context && hasChangedDraft(context.text, [contextEditDraft[context.context]])) ||
    !!(contextDraft[step.step] ?? "").trim();
}
function discardStepEditor(step: Step) {
  delete stepEditDraft[step.step]; delete stepEditVersion[step.step];
  contextDraft[step.step] = ""; contextSelection[step.step] = "";
  if (editingContext.value) { delete contextEditDraft[editingContext.value]; delete contextEditVersion[editingContext.value]; }
  editingContext.value = ""; editingStep.value = "";
  contextComposer[step.step] = false; stepMode[step.step] = "reading";
}
function cancelEditStep(step: Step) {
  if (stepEditorIsDirty(step) && !window.confirm("Discard the unsaved changes in this Step editor?")) return;
  discardStepEditor(step);
}
function toggleQuestions(step: Step) {
  if (stepMode[step.step] === "questions") { stepMode[step.step] = "reading"; return; }
  if (stepMode[step.step] === "editing") {
    if (stepEditorIsDirty(step) && !window.confirm("Discard the unsaved Step and Context changes before opening Questions?")) return;
    discardStepEditor(step);
  }
  stepMode[step.step] = "questions";
}
function saveMyStep(procedure: Procedure, step: Step) { stepEditVersion[step.step] = step.version; editStep(procedure, step); }
function beginAddStep(procedure: Procedure) { addStepVersion[procedure.procedure] = procedure.version; showAddStep.value = true; }
function discardAddedStep(procedure: Procedure) { delete stepDraft[procedure.procedure]; delete addStepVersion[procedure.procedure]; showAddStep.value = false; }
function retryAddedStep(procedure: Procedure) { addStepVersion[procedure.procedure] = procedure.version; addStep(procedure); }
function toggleCreate() {
  if (showCreate.value) {
    if (procedureTitle.value.trim() && !window.confirm("Discard this unsaved Playbook name?")) return;
    procedureTitle.value = "";
  }
  showCreate.value = !showCreate.value;
}
function askQuestion(procedure: Procedure, step: Step) {
  const text = (questionDraft[step.step] ?? "").trim(); if (!text) return;
  emit("askQuestion", { procedure, step, text, onSuccess: () => { questionDraft[step.step] = ""; questionFormOpen[step.step] = false; } });
}
function openContext(step: Step) {
  editSubmode[step.step] = "context";
  contextComposer[step.step] = true;
  const procedureId = selectedProcedure.value?.procedure ?? "";
  const hasAvailable = procedureId ? availableNotesForStep(procedureId, step.step).length > 0 : false;
  if (!hasAvailable) contextMode[step.step] = "new";
  else contextMode[step.step] ??= "existing";
}
function returnToInstruction(step: Step) {
  editSubmode[step.step] = "instruction";
  contextComposer[step.step] = false;
}
function beginContextEdit(note: ContextNote) {
  const current = props.contexts.find(({ context }) => context === editingContext.value);
  if (current && current.context !== note.context && hasChangedDraft(current.text, [contextEditDraft[current.context]]) && !window.confirm("Discard the unsaved Context edit?")) return;
  editingContext.value = note.context;
  if (editingStep.value) contextComposer[editingStep.value] = false;
  contextEditMode[note.context] ??= "correct";
  contextEditDraft[note.context] = note.text;
  contextEditVersion[note.context] = note.version;
}
function cancelContextEdit(note: ContextNote) {
  if (hasChangedDraft(note.text, [contextEditDraft[note.context]]) && !window.confirm("Discard this unsaved Context edit?")) return;
  delete contextEditDraft[note.context]; delete contextEditVersion[note.context]; editingContext.value = "";
}
function affectedActivePlaybookCount(note: ContextNote) {
  return new Set(note.attachments.map(({ subject }) => subject).filter((subject) => activeProcedures.value.some(({ procedure }) => procedure === subject))).size;
}
function saveContextEdit(note: ContextNote) {
  const text = (contextEditDraft[note.context] ?? "").trim();
  if (!text) return;
  const onSuccess = () => { delete contextEditDraft[note.context]; delete contextEditVersion[note.context]; editingContext.value = ""; };
  const payload = { note, text, expectedVersion: contextEditVersion[note.context] ?? note.version, onSuccess };
  const textChanged = hasChangedDraft(note.text, [text]);
  if (contextEditMode[note.context] === "change" && textChanged) emit("changeContext", payload); else emit("correctContext", payload);
}
function useSavedContext(note: ContextNote) {
  contextEditDraft[note.context] = note.text; contextEditVersion[note.context] = note.version; editingContext.value = "";
}
function saveMyContext(note: ContextNote) { contextEditVersion[note.context] = note.version; saveContextEdit(note); }
function attachExistingContext(procedure: Procedure, step: Step) {
  const id = contextSelection[step.step] ?? "";
  const note = props.contexts.find(({ context }) => context === id);
  if (!note) return;
  emit("attachContext", { note, procedure, step, onSuccess: () => { contextSelection[step.step] = ""; contextComposer[step.step] = false; } });
}
function recordStepContext(procedure: Procedure, step: Step) {
  const text = (contextDraft[step.step] ?? "").trim(); if (!text) return;
  emit("recordContext", {
    procedure,
    step,
    text,
    onSuccess: () => { contextDraft[step.step] = ""; contextComposer[step.step] = false; },
    onRecordedOnly: (context) => {
      contextDraft[step.step] = "";
      contextMode[step.step] = "existing";
      contextSelection[step.step] = context;
    },
  });
}
</script>

<template>
  <header class="page-heading heading-with-action playbooks-page-heading">
    <h1>Playbooks</h1>
    <button v-if="canEdit && activeProcedures.length" class="button button-primary" type="button" @click="toggleCreate">{{ showCreate ? "Close" : "New playbook" }}</button>
  </header>

  <form v-if="canEdit && showCreate" class="disclosure-form create-disclosure" @submit.prevent="createProcedure">
    <label for="procedure-title">Playbook name</label>
    <div class="form-row"><input id="procedure-title" v-model="procedureTitle" placeholder="Event setup" required maxlength="160"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !procedureTitle.trim()">{{ actionBusy === "create-procedure" ? "Creating…" : "Create" }}</button></div>
  </form>

  <div v-if="!activeProcedures.length" class="empty-page-state">
    <h2>{{ archivedProcedures.length ? "No active playbooks" : "Start with a playbook" }}</h2>
    <p>{{ archivedProcedures.length ? "Archived playbooks are available below." : "Write the steps for one recurring task." }}</p>
    <button v-if="canEdit && !showCreate" class="button button-primary" type="button" @click="showCreate = true">Create playbook</button>
  </div>

  <div v-else class="playbook-workspace">
    <aside class="playbook-index" aria-label="Active playbooks">
      <div v-if="activeProcedures.length > 6" class="playbook-search"><label class="sr-only" for="playbook-search">Find a playbook</label><input id="playbook-search" v-model="playbookSearch" type="search" placeholder="Find a playbook…"></div>
      <button v-for="procedure in filteredProcedures" :key="procedure.procedure" class="playbook-index-row" :class="[`playbook-hue-${playbookHue(procedure.procedure)}`, { selected: procedure.procedure === selectedProcedureId }]" type="button" :aria-pressed="procedure.procedure === selectedProcedureId" @click="selectProcedure(procedure)">
        <span class="playbook-index-dot" aria-hidden="true"></span>
        <span class="playbook-index-copy"><span>{{ procedure.title }}</span><small>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</small></span>
      </button>
      <p v-if="!filteredProcedures.length" class="playbook-search-empty">No matching playbooks.</p>
    </aside>

    <article v-if="selectedProcedure" class="playbook-document">
      <aside v-if="review?.procedure === selectedProcedure.procedure" class="review-edit-context" aria-label="Review context">
        <div><strong>Editing for review</strong><p>{{ review.causes.length }} {{ review.causes.length === 1 ? "context change affects" : "context changes affect" }} this playbook.</p></div>
        <button class="button button-small button-secondary" type="button" @click="emit('returnToReview')">Back to review</button>
        <div class="review-edit-causes"><p v-for="cause in review.causes" :key="cause.cause"><span>Context now says</span>{{ cause.after }}</p></div>
      </aside>
      <header class="document-header">
        <div class="document-title">
          <form v-if="canEdit && editingTitle === selectedProcedure.procedure" class="title-edit-form" @submit.prevent="renameProcedure(selectedProcedure)">
            <label class="sr-only" :for="`rename-${selectedProcedure.procedure}`">Rename {{ selectedProcedure.title }}</label><input :id="`rename-${selectedProcedure.procedure}`" v-model="titleDraft[selectedProcedure.procedure]" required maxlength="160"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !titleDraft[selectedProcedure.procedure]?.trim()">{{ actionBusy === `rename-${selectedProcedure.procedure}` ? "Saving…" : "Save" }}</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="cancelRename(selectedProcedure)">Cancel</button>
            <VersionConflict v-if="titleEditVersion[selectedProcedure.procedure] !== selectedProcedure.version" subject="playbook name" saved-label="Current saved name" :saved-value="selectedProcedure.title" draft-label="Your unsaved name" :draft-value="titleDraft[selectedProcedure.procedure] ?? ''" :busy="!!actionBusy" @use-saved="useSavedTitle(selectedProcedure)" @save-mine="saveMyTitle(selectedProcedure)" />
          </form>
          <template v-else><h2>{{ selectedProcedure.title }}</h2><p>{{ selectedProcedure.steps.length }} {{ selectedProcedure.steps.length === 1 ? "step" : "steps" }}<span v-if="notesForProcedure(selectedProcedure).length"> · {{ notesForProcedure(selectedProcedure).length }} Playbook context {{ notesForProcedure(selectedProcedure).length === 1 ? "note" : "notes" }}</span></p></template>
        </div>
        <details v-if="canEdit" class="action-menu playbook-more-actions"><summary aria-label="More actions for this Playbook">More</summary><div><button type="button" @click="beginRename(selectedProcedure)">Rename</button><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('archive', selectedProcedure)">Archive</button></div></details>
      </header>

      <div v-if="notesForProcedure(selectedProcedure).length" class="playbook-context-section">
        <article v-for="note in notesForProcedure(selectedProcedure)" :key="note.context" class="playbook-context-card">
          <div v-if="editingContext !== note.context" class="playbook-context-row">
            <p>{{ note.text }}</p>
            <div v-if="canEditContext" class="context-icon-actions">
              <button class="context-icon-button" type="button" :disabled="!!actionBusy" title="Edit" :aria-label="`Edit Context Note`" @click="beginContextEdit(note)"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 14.8.6-3.4L13 3l4 4-8.4 8.4-3.4.6Z"/><path d="m11.8 4.2 4 4"/></svg></button>
              <button v-if="attachmentForProcedure(note, selectedProcedure.procedure)" class="context-icon-button" type="button" :disabled="!!actionBusy" title="Remove from Playbook" :aria-label="`Remove Context Note from playbook`" @click="emit('detachContext', { note, attachment: attachmentForProcedure(note, selectedProcedure.procedure)! })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 6l8 8M14 6l-8 8"/></svg></button>
            </div>
          </div>
          <div v-else class="context-inline-editor">
            <div class="context-edit-help">
              <button type="button" class="context-help-trigger" aria-label="How this edit works" tabindex="0"><span aria-hidden="true">?</span></button>
              <div class="context-help-popover" role="tooltip">
                <p v-if="affectedActivePlaybookCount(note)"><strong>Used in {{ affectedActivePlaybookCount(note) }} {{ affectedActivePlaybookCount(note) === 1 ? "Playbook" : "Playbooks" }}.</strong></p>
                <p><strong>Fix wording:</strong> corrects spelling or phrasing — no Reviews created.</p>
                <p><strong>Information changed:</strong> records the change and flags affected Playbooks for Review.</p>
              </div>
            </div>
            <form class="context-note-editor" @submit.prevent="saveContextEdit(note)">
              <textarea :id="`context-edit-${note.context}`" :ref="autoresizeEl" v-model="contextEditDraft[note.context]" required maxlength="4000" rows="1" class="autoresize" @input="autoresize"></textarea>
              <div class="edit-type-chooser">
                <label :class="{ active: contextEditMode[note.context] === 'correct' }"><input v-model="contextEditMode[note.context]" type="radio" value="correct">Fix wording</label>
                <label :class="{ active: contextEditMode[note.context] === 'change' }"><input v-model="contextEditMode[note.context]" type="radio" value="change">Information changed</label>
              </div>
              <p v-if="contextEditMode[note.context] === 'change' && hasChangedDraft(note.text, [contextEditDraft[note.context]])" class="form-guidance pending-guidance">{{ meaningfulChangeConsequence(affectedActivePlaybookCount(note)) }}</p>
              <div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(contextEditDraft[note.context] ?? '').trim() || !hasChangedDraft(note.text, [contextEditDraft[note.context]])">{{ contextEditMode[note.context] === "change" && hasChangedDraft(note.text, [contextEditDraft[note.context]]) ? meaningfulChangeActionLabel(affectedActivePlaybookCount(note)) : "Save wording" }}</button><button class="button button-small button-quiet" type="button" @click="cancelContextEdit(note)">Cancel</button></div>
              <VersionConflict v-if="contextEditVersion[note.context] !== note.version" subject="context note" saved-label="Current saved note" :saved-value="note.text" draft-label="Your unsaved note" :draft-value="contextEditDraft[note.context] ?? ''" :busy="!!actionBusy" @use-saved="useSavedContext(note)" @save-mine="saveMyContext(note)" />
            </form>
          </div>
        </article>
      </div>

      <ol v-if="selectedProcedure.steps.length" class="document-steps">
        <li v-for="step in selectedProcedure.steps" :key="step.step" class="document-step">
          <span class="step-index">{{ step.position }}</span>
          <div class="step-body">
            <section v-if="canEdit && editingStep === step.step" class="step-edit-surface" :aria-labelledby="`step-editor-title-${step.step}`">
              <div v-if="editSubmode[step.step] !== 'context'" class="step-instruction-editor">
                <form class="step-edit-form" @submit.prevent="editStep(selectedProcedure, step)">
                  <label class="sr-only" :for="`edit-${step.step}`">Step {{ step.position }} instruction</label><textarea :id="`edit-${step.step}`" :ref="autoresizeEl" v-model="stepEditDraft[step.step]" class="step-wording-input autoresize" required maxlength="500" rows="1" autofocus @input="autoresize"></textarea>
                  <span v-if="hasChangedDraft(step.text, [stepEditDraft[step.step]])" class="step-unsaved-status">Unsaved step changes</span>
                  <div v-if="notesForStep(selectedProcedure.procedure, step.step).length" class="step-context-reading" aria-label="Supporting context">
                    <span class="step-context-heading"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 4h9a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2V4z"/><path d="M4 14a2 2 0 0 1 2-2h9"/></svg>Supporting context · {{ notesForStep(selectedProcedure.procedure, step.step).length }} {{ notesForStep(selectedProcedure.procedure, step.step).length === 1 ? "note" : "notes" }}</span>
                    <article v-for="note in notesForStep(selectedProcedure.procedure, step.step)" :key="note.context" class="context-with-actions"><p>{{ note.text }}</p><div v-if="canEditContext" class="context-icon-actions"><button class="context-icon-button" type="button" :aria-label="`Edit shared Context Note for step ${step.position}`" title="Edit" @click="openContext(step); beginContextEdit(note)"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 14.8.6-3.4L13 3l4 4-8.4 8.4-3.4.6Z"/><path d="m11.8 4.2 4 4"/></svg></button><button v-if="attachmentForStep(note, selectedProcedure.procedure, step.step)" class="context-icon-button" type="button" :disabled="!!actionBusy" :aria-label="`Remove Context Note from step ${step.position}`" title="Remove" @click="emit('detachContext', { note, attachment: attachmentForStep(note, selectedProcedure.procedure, step.step)! })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 6l8 8M14 6l-8 8"/></svg></button></div></article>
                  </div>
                  <button v-if="canEditContext" class="context-attach-action" :class="{ 'has-context': notesForStep(selectedProcedure.procedure, step.step).length }" type="button" @click="openContext(step)">{{ notesForStep(selectedProcedure.procedure, step.step).length ? "+ Add more context" : "+ Add context" }}</button>
                  <div class="step-edit-footer"><button class="context-back-action" type="button" :disabled="!!actionBusy" @click="cancelEditStep(step)">← Back to instruction</button><button class="context-back-action step-save-action" type="submit" :disabled="!!actionBusy || !stepEditDraft[step.step]?.trim() || !hasChangedDraft(step.text, [stepEditDraft[step.step]])">{{ actionBusy === `edit-${step.step}` ? "Saving…" : "Save step" }}</button></div>
                </form>
              </div>
              <VersionConflict v-if="editSubmode[step.step] !== 'context' && stepEditVersion[step.step] !== step.version" subject="step" saved-label="Current saved instruction" :saved-value="step.text" draft-label="Your unsaved instruction" :draft-value="stepEditDraft[step.step] ?? ''" :busy="!!actionBusy" @use-saved="cancelEditStep(step)" @save-mine="saveMyStep(selectedProcedure, step)" />
              <section v-if="editSubmode[step.step] === 'context'" class="step-context-editor context-attachment-mode" aria-label="Manage Context for this Step">
                <header class="context-attachment-header"><button class="context-back-action" type="button" @click="returnToInstruction(step)">← Back to instruction</button></header>
                <p class="context-attachment-step-preview" aria-label="Attaching context to step">{{ step.text }}</p>
                <div v-if="notesForStep(selectedProcedure.procedure, step.step).length && (!contextComposer[step.step] || editingContext)" class="step-context-list editing">
                  <article v-for="note in notesForStep(selectedProcedure.procedure, step.step)" :key="note.context" class="attached-context-row context-with-actions">
                    <blockquote v-if="editingContext !== note.context">{{ note.text }}</blockquote>
                    <div v-if="canEditContext && editingContext !== note.context" class="context-icon-actions"><button class="context-icon-button" type="button" :aria-label="`Edit shared Context Note for step ${step.position}`" title="Edit" @click="beginContextEdit(note)"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 14.8.6-3.4L13 3l4 4-8.4 8.4-3.4.6Z"/><path d="m11.8 4.2 4 4"/></svg></button><button v-if="attachmentForStep(note, selectedProcedure.procedure, step.step)" class="context-icon-button" type="button" :disabled="!!actionBusy" :aria-label="`Remove Context Note from step ${step.position}`" title="Remove" @click="emit('detachContext', { note, attachment: attachmentForStep(note, selectedProcedure.procedure, step.step)! })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 6l8 8M14 6l-8 8"/></svg></button></div>
                    <div v-if="editingContext === note.context" class="context-inline-editor">
                      <div class="context-edit-help">
              <button type="button" class="context-help-trigger" aria-label="How this edit works" tabindex="0"><span aria-hidden="true">?</span></button>
              <div class="context-help-popover" role="tooltip">
                <p v-if="affectedActivePlaybookCount(note)"><strong>Used in {{ affectedActivePlaybookCount(note) }} {{ affectedActivePlaybookCount(note) === 1 ? "Playbook" : "Playbooks" }}.</strong></p>
                <p><strong>Fix wording:</strong> corrects spelling or phrasing — no Reviews created.</p>
                <p><strong>Information changed:</strong> records the change and flags affected Playbooks for Review.</p>
              </div>
            </div>
                      <form class="context-note-editor" @submit.prevent="saveContextEdit(note)">
                        <textarea :id="`context-edit-${note.context}`" :ref="autoresizeEl" v-model="contextEditDraft[note.context]" required maxlength="4000" rows="1" class="autoresize" @input="autoresize"></textarea>
                        <div class="edit-type-chooser">
                          <label :class="{ active: contextEditMode[note.context] === 'correct' }"><input v-model="contextEditMode[note.context]" type="radio" value="correct">Fix wording</label>
                          <label :class="{ active: contextEditMode[note.context] === 'change' }"><input v-model="contextEditMode[note.context]" type="radio" value="change">Information changed</label>
                        </div>
                        <p v-if="contextEditMode[note.context] === 'correct'" class="form-guidance edit-type-hint">Corrects spelling or phrasing — no Reviews created.</p>
                        <p v-else-if="contextEditMode[note.context] === 'change' && hasChangedDraft(note.text, [contextEditDraft[note.context]])" class="form-guidance pending-guidance">{{ meaningfulChangeConsequence(affectedActivePlaybookCount(note)) }}</p>
                        <p v-else class="form-guidance edit-type-hint">Records the change and flags affected Playbooks for Review.</p>
                        <div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(contextEditDraft[note.context] ?? '').trim() || !hasChangedDraft(note.text, [contextEditDraft[note.context]])">{{ contextEditMode[note.context] === "change" && hasChangedDraft(note.text, [contextEditDraft[note.context]]) ? meaningfulChangeActionLabel(affectedActivePlaybookCount(note)) : "Save wording" }}</button><button class="button button-small button-quiet" type="button" @click="cancelContextEdit(note)">Cancel</button></div>
                        <VersionConflict v-if="contextEditVersion[note.context] !== note.version" subject="context note" saved-label="Current saved note" :saved-value="note.text" draft-label="Your unsaved note" :draft-value="contextEditDraft[note.context] ?? ''" :busy="!!actionBusy" @use-saved="useSavedContext(note)" @save-mine="saveMyContext(note)" />
                      </form>
                    </div>
                  </article>
                </div>
                <div v-if="contextComposer[step.step] && canEditContext && !editingContext" class="context-connect">
                  <div class="context-mode" role="group" :aria-label="`Add context to step ${step.position}`"><button type="button" :class="{ active: contextMode[step.step] !== 'new' }" :disabled="!availableNotesForStep(selectedProcedure.procedure, step.step).length" :title="!availableNotesForStep(selectedProcedure.procedure, step.step).length ? 'No notes available — write a new one' : undefined" @click="contextMode[step.step] = 'existing'">Use existing</button><button type="button" :class="{ active: contextMode[step.step] === 'new' }" @click="contextMode[step.step] = 'new'">Write new</button></div>
                  <form v-if="contextMode[step.step] !== 'new'" class="context-connect-form" @submit.prevent="attachExistingContext(selectedProcedure, step)"><label class="sr-only" :for="`context-for-${step.step}`">Choose existing context</label><select :id="`context-for-${step.step}`" v-model="contextSelection[step.step]" required :disabled="!availableNotesForStep(selectedProcedure.procedure, step.step).length"><option value="" disabled>{{ availableNotesForStep(selectedProcedure.procedure, step.step).length ? "Choose a note…" : "No notes available — use Write new" }}</option><option v-for="note in availableNotesForStep(selectedProcedure.procedure, step.step)" :key="note.context" :value="note.context">{{ note.text }}</option></select><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !contextSelection[step.step]">{{ actionBusy === `attach-step-${step.step}` ? "Attaching…" : "Attach note" }}</button></form>
                  <form v-else class="context-connect-form context-connect-new" @submit.prevent="recordStepContext(selectedProcedure, step)"><label class="sr-only" :for="`new-context-${step.step}`">New shared Context Note</label><textarea :id="`new-context-${step.step}`" v-model="contextDraft[step.step]" placeholder="Record the decision, constraint, or reason…" required maxlength="4000" rows="1" class="autoresize" @input="autoresize"></textarea><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(contextDraft[step.step] ?? '').trim()">{{ actionBusy === `record-step-context-${step.step}` ? "Saving…" : "Attach" }}</button></form>
                </div>
              </section>
            </section>
            <template v-else>
              <p class="step-text">{{ step.text }}</p>
              <div v-if="notesForStep(selectedProcedure.procedure, step.step).length" class="step-context-reading" aria-label="Supporting context">
                <span class="step-context-heading"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 4h9a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2V4z"/><path d="M4 14a2 2 0 0 1 2-2h9"/></svg>Supporting context · {{ notesForStep(selectedProcedure.procedure, step.step).length }} {{ notesForStep(selectedProcedure.procedure, step.step).length === 1 ? "note" : "notes" }}</span>
                <article v-for="note in notesForStep(selectedProcedure.procedure, step.step)" :key="note.context"><p :class="{ 'is-collapsed': note.text.length > 320 && !expandedContext[note.context] }">{{ note.text }}</p><button v-if="note.text.length > 320" type="button" :aria-expanded="!!expandedContext[note.context]" @click="expandedContext[note.context] = !expandedContext[note.context]">{{ expandedContext[note.context] ? "Show less" : "Show more" }}</button></article>
              </div>
            </template>
            <section v-if="stepMode[step.step] === 'questions'" class="inline-disclosure step-question-disclosure" :aria-label="`Questions about step ${step.position}`">
              <div v-if="questionsForStep(step.step).length" class="step-question-list"><article v-for="question in questionsForStep(step.step)" :key="question.question" class="step-question-item" :aria-label="question.status === 'OPEN' ? 'Open question' : 'Answered question'"><div class="step-question-copy"><span class="conversation-identifier" aria-hidden="true">Q</span><div class="conversation-line"><p class="step-question-text">{{ question.text }}</p><div class="conversation-question-actions"><time v-if="questionDate(question.askedAt)" class="conversation-meta" :datetime="question.askedAt ?? undefined">{{ questionDate(question.askedAt) }}</time><button v-if="question.answer" class="conversation-toggle-action" type="button" :aria-expanded="!!expandedAnswer[question.question]" :aria-label="`${expandedAnswer[question.question] ? 'Hide' : 'Show'} answer to: ${question.text}`" :title="expandedAnswer[question.question] ? 'Hide answer' : 'Show answer'" @click="expandedAnswer[question.question] = !expandedAnswer[question.question]"><svg aria-hidden="true" viewBox="0 0 20 20" :style="expandedAnswer[question.question] ? 'transform: rotate(180deg)' : ''"><path d="M5 8l5 5 5-5"/></svg></button><button v-if="canRemoveQuestions" class="conversation-delete-action" type="button" :disabled="!!actionBusy" :aria-label="`Permanently delete question: ${question.text}`" title="Delete question" @click="emit('removeQuestion', { kind: 'step', question })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 6l8 8M14 6l-8 8"/></svg></button></div></div></div><div v-if="question.answer && expandedAnswer[question.question]" class="step-answer-copy"><span class="conversation-identifier" aria-hidden="true">R</span><div class="conversation-line"><p class="step-question-answer">{{ question.answer }}</p><small v-if="answererName(question.answerer)" class="conversation-meta">{{ answererName(question.answerer) }}</small></div></div></article></div>
              <button v-if="!questionFormOpen[step.step]" class="question-compose-action" :class="{ button: !questionsForStep(step.step).length, 'button-small': !questionsForStep(step.step).length, 'button-secondary': !questionsForStep(step.step).length }" type="button" :aria-expanded="false" @click="questionFormOpen[step.step] = true">{{ questionsForStep(step.step).length ? "+ Ask another question" : "Ask a question" }}</button>
              <form v-else class="question-form step-question-form" @submit.prevent="askQuestion(selectedProcedure, step)"><label class="sr-only" :for="`question-${step.step}`">Ask about step {{ step.position }}</label><div class="form-row"><input :id="`question-${step.step}`" v-model="questionDraft[step.step]" placeholder="What needs clarification?" required maxlength="1000"><button class="button button-small button-quiet" type="button" @click="questionFormOpen[step.step] = false">Cancel</button><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(questionDraft[step.step] ?? '').trim()">{{ actionBusy === `ask-step-${step.step}` ? "Sending…" : "Ask" }}</button></div></form>
            </section>
          </div>
          <div class="step-action-toolbar" role="toolbar" :aria-label="`Actions for step ${step.position}`">
            <button v-if="canEdit" class="step-icon-action" :class="{ active: stepMode[step.step] === 'editing' }" type="button" :disabled="!!actionBusy" :aria-pressed="stepMode[step.step] === 'editing'" :aria-label="`Edit step ${step.position} and its context`" title="Edit Step and Context" @click="beginEditStep(step)"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 14.8.6-3.4L13 3l4 4-8.4 8.4-3.4.6Z"/><path d="m11.8 4.2 4 4"/></svg></button>
            <button class="step-icon-action question-action" :class="{ active: stepMode[step.step] === 'questions' }" type="button" :aria-expanded="stepMode[step.step] === 'questions'" :aria-label="`${questionsForStep(step.step).length ? `View ${questionsForStep(step.step).length} questions` : 'Ask a question'} about step ${step.position}`" title="Questions" @click="toggleQuestions(step)"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 4.5h12v8H9l-4 3v-3H4Z"/></svg><span v-if="questionsForStep(step.step).length">{{ questionsForStep(step.step).length }}</span></button>
            <details v-if="canEdit && stepMode[step.step] !== 'editing'" class="step-more-actions"><summary :aria-label="`More actions for step ${step.position}`" title="More actions"><svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/></svg></summary><div><button type="button" :disabled="!!actionBusy || step.position === 1" @click="emit('moveStep', { procedure: selectedProcedure, step, position: step.position - 1 })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 12.5 10 7l5 5.5"/></svg>Move up</button><button type="button" :disabled="!!actionBusy || step.position === selectedProcedure.steps.length" @click="emit('moveStep', { procedure: selectedProcedure, step, position: step.position + 1 })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7.5 5 5.5 5-5.5"/></svg>Move down</button><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('removeStep', { procedure: selectedProcedure, step })">Delete Step</button></div></details>
          </div>
        </li>
      </ol>

      <div v-if="canEdit" class="add-step-control">
        <button v-if="!showAddStep && selectedProcedure.steps.length" class="text-button" type="button" @click="beginAddStep(selectedProcedure)">+ Add step</button>
        <form v-else class="add-step-form" @submit.prevent="addStep(selectedProcedure)">
          <label class="sr-only" :for="`step-${selectedProcedure.procedure}`">New step</label>
          <textarea :id="`step-${selectedProcedure.procedure}`" v-model="stepDraft[selectedProcedure.procedure]" placeholder="Write one clear instruction…" required maxlength="500" rows="3" @focus="addStepVersion[selectedProcedure.procedure] ??= selectedProcedure.version"></textarea>
          <div class="form-actions">
            <button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(stepDraft[selectedProcedure.procedure] ?? '').trim()">{{ actionBusy === `step-${selectedProcedure.procedure}` ? "Adding…" : "Add step" }}</button>
            <button v-if="selectedProcedure.steps.length" class="button button-small button-quiet" type="button" @click="discardAddedStep(selectedProcedure)">Cancel</button>
          </div>
          <VersionConflict v-if="addStepVersion[selectedProcedure.procedure] !== undefined && addStepVersion[selectedProcedure.procedure] !== selectedProcedure.version" subject="playbook structure" saved-label="Current saved steps" :saved-value="`${selectedProcedure.steps.length} ${selectedProcedure.steps.length === 1 ? 'step' : 'steps'}, shown above`" draft-label="Your unsaved new step" :draft-value="stepDraft[selectedProcedure.procedure] ?? ''" use-saved-label="Keep current steps" save-mine-label="Add my step" save-consequence="Adding your step keeps the current steps and appends your draft only if the structure has not changed again." :busy="!!actionBusy" @use-saved="discardAddedStep(selectedProcedure)" @save-mine="retryAddedStep(selectedProcedure)" />
        </form>
      </div>

    </article>
  </div>

  <details v-if="archivedProcedures.length" class="quiet-history archived-playbooks" :open="!!focusedArchivedId"><summary>Archived playbooks <span>{{ archivedProcedures.length }}</span></summary><p class="form-guidance">Archived Playbooks remain available as history, but Relay does not currently provide a way to restore them.</p><article v-for="procedure in archivedProcedures" :key="procedure.procedure" class="archived-playbook" :class="{ 'activity-target': procedure.procedure === focusedArchivedId }"><header><strong>{{ procedure.title }}</strong><small>{{ procedure.steps.length }} steps</small></header><ol><li v-for="step in procedure.steps" :key="step.step"><span>{{ step.position }}</span>{{ step.text }}</li></ol></article></details>
</template>
