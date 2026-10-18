<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { ContextNote, PendingReview, Procedure, Step, StepQuestion } from "../api.ts";

const props = defineProps<{ procedures: Procedure[]; contexts: ContextNote[]; stepQuestions: StepQuestion[]; actionBusy: string; canEdit: boolean; canEditContext: boolean; focusProcedure?: string; focusContextStep?: string; startCreate?: boolean; review?: PendingReview }>();
const emit = defineEmits<{
  create: [payload: { title: string; onSuccess: () => void }];
  addStep: [payload: { procedure: Procedure; text: string; onSuccess: () => void }];
  rename: [payload: { procedure: Procedure; title: string; onSuccess: () => void }];
  editStep: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void }];
  moveStep: [payload: { procedure: Procedure; step: Step; position: number }];
  removeStep: [payload: { procedure: Procedure; step: Step }];
  askQuestion: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void }];
  attachContext: [payload: { note: ContextNote; procedure: Procedure; step: Step; onSuccess: () => void }];
  recordContext: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void }];
  archive: [procedure: Procedure];
  returnToReview: [];
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
const questionDraft = reactive<Record<string, string>>({});
const questionComposer = reactive<Record<string, boolean>>({});
const contextComposer = reactive<Record<string, boolean>>({});
const contextMode = reactive<Record<string, "existing" | "new">>({});
const contextSelection = reactive<Record<string, string>>({});
const contextDraft = reactive<Record<string, string>>({});
const editingTitle = ref("");
const editingStep = ref("");
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const archivedProcedures = computed(() => props.procedures.filter(({ status }) => status === "RETIRED"));
const filteredProcedures = computed(() => {
  const query = playbookSearch.value.trim().toLocaleLowerCase();
  return query ? activeProcedures.value.filter(({ title }) => title.toLocaleLowerCase().includes(query)) : activeProcedures.value;
});
const selectedProcedure = computed(() => activeProcedures.value.find(({ procedure }) => procedure === selectedProcedureId.value));

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

function selectProcedure(procedure: Procedure) {
  selectedProcedureId.value = procedure.procedure;
  focusedArchivedId.value = "";
  editingTitle.value = "";
  editingStep.value = "";
  showAddStep.value = false;
}
function notesForProcedure(procedure: Procedure) {
  const stepIds = new Set(procedure.steps.map(({ step }) => step));
  return props.contexts.filter((note) =>
    note.attachments.some((attachment) => attachment.subject === procedure.procedure && !attachment.anchor) &&
    !note.attachments.some((attachment) => attachment.subject === procedure.procedure && !!attachment.anchor && stepIds.has(attachment.anchor)));
}
function notesForStep(procedureId: string, stepId: string) { return props.contexts.filter((note) => note.attachments.some((attachment) => attachment.subject === procedureId && attachment.anchor === stepId)); }
function availableNotesForStep(procedureId: string, stepId: string) { return props.contexts.filter((note) => !note.attachments.some((attachment) => attachment.subject === procedureId && attachment.anchor === stepId)); }
function questionsForStep(step: string) { return props.stepQuestions.filter((question) => question.step === step); }
function createProcedure() {
  const title = procedureTitle.value.trim(); if (!title) return;
  emit("create", { title, onSuccess: () => { procedureTitle.value = ""; showCreate.value = false; } });
}
function addStep(procedure: Procedure) {
  const text = (stepDraft[procedure.procedure] ?? "").trim(); if (!text) return;
  emit("addStep", { procedure, text, onSuccess: () => { stepDraft[procedure.procedure] = ""; showAddStep.value = false; } });
}
function beginRename(procedure: Procedure) { titleDraft[procedure.procedure] = procedure.title; editingTitle.value = procedure.procedure; }
function renameProcedure(procedure: Procedure) {
  const title = (titleDraft[procedure.procedure] ?? "").trim(); if (!title) return;
  emit("rename", { procedure, title, onSuccess: () => { editingTitle.value = ""; } });
}
function beginEditStep(step: Step) { stepEditDraft[step.step] = step.text; editingStep.value = step.step; }
function editStep(procedure: Procedure, step: Step) {
  const text = (stepEditDraft[step.step] ?? "").trim(); if (!text) return;
  emit("editStep", { procedure, step, text, onSuccess: () => { delete stepEditDraft[step.step]; editingStep.value = ""; } });
}
function cancelEditStep(step: Step) { delete stepEditDraft[step.step]; editingStep.value = ""; }
function askQuestion(procedure: Procedure, step: Step) {
  const text = (questionDraft[step.step] ?? "").trim(); if (!text) return;
  emit("askQuestion", { procedure, step, text, onSuccess: () => { questionDraft[step.step] = ""; questionComposer[step.step] = false; } });
}
function openContext(step: Step) {
  contextComposer[step.step] = !contextComposer[step.step];
  if (contextComposer[step.step]) contextMode[step.step] ??= props.contexts.length ? "existing" : "new";
}
function attachExistingContext(procedure: Procedure, step: Step) {
  const id = contextSelection[step.step] ?? "";
  const note = props.contexts.find(({ context }) => context === id);
  if (!note) return;
  emit("attachContext", { note, procedure, step, onSuccess: () => { contextSelection[step.step] = ""; } });
}
function recordStepContext(procedure: Procedure, step: Step) {
  const text = (contextDraft[step.step] ?? "").trim(); if (!text) return;
  emit("recordContext", { procedure, step, text, onSuccess: () => { contextDraft[step.step] = ""; } });
}
</script>

<template>
  <header class="page-heading heading-with-action">
    <h1>Playbooks</h1>
    <button v-if="canEdit && activeProcedures.length" class="button button-primary" type="button" @click="showCreate = !showCreate">{{ showCreate ? "Close" : "New playbook" }}</button>
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
      <button v-for="procedure in filteredProcedures" :key="procedure.procedure" class="playbook-index-row" :class="{ selected: procedure.procedure === selectedProcedureId }" type="button" :aria-pressed="procedure.procedure === selectedProcedureId" @click="selectProcedure(procedure)">
        <span>{{ procedure.title }}</span><small>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</small>
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
            <label class="sr-only" :for="`rename-${selectedProcedure.procedure}`">Rename {{ selectedProcedure.title }}</label><input :id="`rename-${selectedProcedure.procedure}`" v-model="titleDraft[selectedProcedure.procedure]" required maxlength="160"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !titleDraft[selectedProcedure.procedure]?.trim()">Save</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="editingTitle = ''">Cancel</button>
          </form>
          <template v-else><h2>{{ selectedProcedure.title }}</h2><p>{{ selectedProcedure.steps.length }} {{ selectedProcedure.steps.length === 1 ? "step" : "steps" }}</p></template>
        </div>
        <details v-if="canEdit" class="action-menu"><summary aria-label="Playbook actions">Actions</summary><div><button type="button" @click="beginRename(selectedProcedure)">Rename</button><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('archive', selectedProcedure)">Archive</button></div></details>
      </header>

      <ol v-if="selectedProcedure.steps.length" class="document-steps">
        <li v-for="step in selectedProcedure.steps" :key="step.step" class="document-step">
          <span class="step-index">{{ step.position }}</span>
          <div class="step-body">
            <form v-if="canEdit && editingStep === step.step" class="step-edit-form" @submit.prevent="editStep(selectedProcedure, step)">
              <label class="sr-only" :for="`edit-${step.step}`">Edit step {{ step.position }}</label><textarea :id="`edit-${step.step}`" v-model="stepEditDraft[step.step]" required maxlength="500" rows="3" autofocus></textarea><div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !stepEditDraft[step.step]?.trim()">{{ actionBusy === `edit-${step.step}` ? "Saving…" : "Save" }}</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="cancelEditStep(step)">Cancel</button></div>
            </form>
            <template v-else>
              <p class="step-text">{{ step.text }}</p>
              <div class="step-tools"><button v-if="notesForStep(selectedProcedure.procedure, step.step).length" type="button" :aria-expanded="!!contextComposer[step.step]" @click="openContext(step)">Why this matters{{ notesForStep(selectedProcedure.procedure, step.step).length > 1 ? ` (${notesForStep(selectedProcedure.procedure, step.step).length})` : "" }}</button><button v-else-if="canEditContext" type="button" :aria-expanded="!!contextComposer[step.step]" @click="openContext(step)">+ Add context</button><button type="button" :aria-expanded="!!questionComposer[step.step]" @click="questionComposer[step.step] = !questionComposer[step.step]">Questions{{ questionsForStep(step.step).length ? ` (${questionsForStep(step.step).length})` : "" }}</button></div>
            </template>
            <section v-if="contextComposer[step.step]" class="inline-disclosure step-context-disclosure" :aria-label="`Context for step ${step.position}`">
              <div v-if="notesForStep(selectedProcedure.procedure, step.step).length" class="step-context-list"><blockquote v-for="note in notesForStep(selectedProcedure.procedure, step.step)" :key="note.context">{{ note.text }}</blockquote></div>
              <div v-if="canEditContext" class="context-connect">
                <div class="context-mode" role="group" :aria-label="`Add context to step ${step.position}`"><button type="button" :class="{ active: contextMode[step.step] !== 'new' }" @click="contextMode[step.step] = 'existing'">Use existing</button><button type="button" :class="{ active: contextMode[step.step] === 'new' }" @click="contextMode[step.step] = 'new'">Write new</button></div>
                <form v-if="contextMode[step.step] !== 'new'" class="context-connect-form" @submit.prevent="attachExistingContext(selectedProcedure, step)"><label class="sr-only" :for="`context-for-${step.step}`">Choose existing context</label><select :id="`context-for-${step.step}`" v-model="contextSelection[step.step]" required><option value="" disabled>Choose a note…</option><option v-for="note in availableNotesForStep(selectedProcedure.procedure, step.step)" :key="note.context" :value="note.context">{{ note.text }}</option></select><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !contextSelection[step.step]">{{ actionBusy === `attach-step-${step.step}` ? "Attaching…" : "Attach" }}</button></form>
                <form v-else class="context-connect-form context-connect-new" @submit.prevent="recordStepContext(selectedProcedure, step)"><label :for="`new-context-${step.step}`">Why does this step matter? <span class="context-optional">Optional</span></label><textarea :id="`new-context-${step.step}`" v-model="contextDraft[step.step]" placeholder="Add a decision, constraint, or useful explanation…" required maxlength="4000" rows="2"></textarea><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(contextDraft[step.step] ?? '').trim()">{{ actionBusy === `record-step-context-${step.step}` ? "Saving…" : "Save and attach" }}</button></form>
                <p v-if="contextMode[step.step] !== 'new' && !availableNotesForStep(selectedProcedure.procedure, step.step).length" class="form-guidance">No other notes are available. Write a new one instead.</p>
              </div>
            </section>
            <section v-if="questionComposer[step.step]" class="inline-disclosure" :aria-label="`Questions about step ${step.position}`">
              <div v-if="questionsForStep(step.step).length" class="subject-question-list"><article v-for="question in questionsForStep(step.step)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }"><strong>{{ question.status === "OPEN" ? "Awaiting answer" : "Answered" }}</strong><p>{{ question.text }}</p><p v-if="question.answer" class="question-answer"><span>Answer</span>{{ question.answer }}</p></article></div>
              <form class="question-form" @submit.prevent="askQuestion(selectedProcedure, step)"><label :for="`question-${step.step}`">Ask about this step</label><div class="form-row"><input :id="`question-${step.step}`" v-model="questionDraft[step.step]" placeholder="What needs clarification?" required maxlength="1000"><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(questionDraft[step.step] ?? '').trim()">{{ actionBusy === `ask-step-${step.step}` ? "Sending…" : "Ask" }}</button></div></form>
            </section>
          </div>
          <div v-if="canEdit && editingStep !== step.step" class="step-action-toolbar" role="toolbar" :aria-label="`Edit step ${step.position}`">
            <button type="button" :disabled="!!actionBusy || step.position === 1" :aria-label="`Move step ${step.position} up`" title="Move up" @click="emit('moveStep', { procedure: selectedProcedure, step, position: step.position - 1 })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 12.5 10 7l5 5.5" /></svg></button>
            <button type="button" :disabled="!!actionBusy || step.position === selectedProcedure.steps.length" :aria-label="`Move step ${step.position} down`" title="Move down" @click="emit('moveStep', { procedure: selectedProcedure, step, position: step.position + 1 })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7.5 5 5.5 5-5.5" /></svg></button>
            <button type="button" :disabled="!!actionBusy" :aria-label="`Edit step ${step.position}`" title="Edit step" @click="beginEditStep(step)"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 14.8.6-3.4L13 3l4 4-8.4 8.4-3.4.6Z" /><path d="m11.8 4.2 4 4" /></svg></button>
            <button class="danger" type="button" :disabled="!!actionBusy" :aria-label="`Remove step ${step.position}`" title="Remove step" @click="emit('removeStep', { procedure: selectedProcedure, step })"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 6h12M8 3.5h4M6 6l.7 10h6.6L14 6M8.5 9v4.5M11.5 9v4.5" /></svg></button>
          </div>
        </li>
      </ol>

      <div v-if="canEdit" class="add-step-control">
        <button v-if="!showAddStep" class="text-button" type="button" @click="showAddStep = true">+ Add step</button>
        <form v-else class="disclosure-form" @submit.prevent="addStep(selectedProcedure)"><label :for="`step-${selectedProcedure.procedure}`">New step</label><textarea :id="`step-${selectedProcedure.procedure}`" v-model="stepDraft[selectedProcedure.procedure]" placeholder="Write one clear instruction…" required maxlength="500" rows="3"></textarea><div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(stepDraft[selectedProcedure.procedure] ?? '').trim()">{{ actionBusy === `step-${selectedProcedure.procedure}` ? "Adding…" : "Add step" }}</button><button class="button button-small button-quiet" type="button" @click="showAddStep = false">Cancel</button></div></form>
      </div>

      <details v-if="notesForProcedure(selectedProcedure).length" class="quiet-history document-context"><summary>Context <span>{{ notesForProcedure(selectedProcedure).length }}</span></summary><div class="context-callouts"><blockquote v-for="note in notesForProcedure(selectedProcedure)" :key="note.context">{{ note.text }}</blockquote></div></details>
    </article>
  </div>

  <details v-if="archivedProcedures.length" class="quiet-history archived-playbooks" :open="!!focusedArchivedId"><summary>Archived playbooks <span>{{ archivedProcedures.length }}</span></summary><article v-for="procedure in archivedProcedures" :key="procedure.procedure" class="archived-playbook" :class="{ 'activity-target': procedure.procedure === focusedArchivedId }"><header><strong>{{ procedure.title }}</strong><small>{{ procedure.steps.length }} steps</small></header><ol><li v-for="step in procedure.steps" :key="step.step"><span>{{ step.position }}</span>{{ step.text }}</li></ol></article></details>
</template>
