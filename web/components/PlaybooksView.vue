<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { ContextNote, Procedure, Step, StepQuestion } from "../api.ts";

const props = defineProps<{ procedures: Procedure[]; contexts: ContextNote[]; stepQuestions: StepQuestion[]; actionBusy: string; canEdit: boolean; focusProcedure?: string }>();
const emit = defineEmits<{
  create: [payload: { title: string; onSuccess: () => void }];
  addStep: [payload: { procedure: Procedure; text: string; onSuccess: () => void }];
  rename: [payload: { procedure: Procedure; title: string; onSuccess: () => void }];
  editStep: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void }];
  moveStep: [payload: { procedure: Procedure; step: Step; position: number }];
  removeStep: [payload: { procedure: Procedure; step: Step }];
  askQuestion: [payload: { procedure: Procedure; step: Step; text: string; onSuccess: () => void }];
  archive: [procedure: Procedure];
}>();

const procedureTitle = ref("");
const selectedProcedureId = ref("");
const showCreate = ref(false);
const showAddStep = ref(false);
const stepDraft = reactive<Record<string, string>>({});
const titleDraft = reactive<Record<string, string>>({});
const stepEditDraft = reactive<Record<string, string>>({});
const questionDraft = reactive<Record<string, string>>({});
const questionComposer = reactive<Record<string, boolean>>({});
const editingTitle = ref("");
const editingStep = ref("");
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const archivedProcedures = computed(() => props.procedures.filter(({ status }) => status === "RETIRED"));
const selectedProcedure = computed(() => activeProcedures.value.find(({ procedure }) => procedure === selectedProcedureId.value));

watch(activeProcedures, (procedures) => {
  if (!procedures.some(({ procedure }) => procedure === selectedProcedureId.value)) selectedProcedureId.value = procedures[0]?.procedure ?? "";
}, { immediate: true });

watch(() => props.focusProcedure, (procedure) => {
  if (procedure && activeProcedures.value.some(({ procedure: id }) => id === procedure)) selectedProcedureId.value = procedure;
}, { immediate: true });

function selectProcedure(procedure: Procedure) {
  selectedProcedureId.value = procedure.procedure;
  editingTitle.value = "";
  editingStep.value = "";
  showAddStep.value = false;
}
function notesForProcedure(procedureId: string) { return props.contexts.filter((note) => note.attachments.some((attachment) => attachment.subject === procedureId)); }
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
  emit("editStep", { procedure, step, text, onSuccess: () => { editingStep.value = ""; } });
}
function askQuestion(procedure: Procedure, step: Step) {
  const text = (questionDraft[step.step] ?? "").trim(); if (!text) return;
  emit("askQuestion", { procedure, step, text, onSuccess: () => { questionDraft[step.step] = ""; questionComposer[step.step] = false; } });
}
</script>

<template>
  <header class="page-heading heading-with-action">
    <div><h1>Playbooks</h1><p class="page-intro">The official steps your club follows, with the context and answers that explain them.</p></div>
    <button v-if="canEdit" class="button button-primary" type="button" @click="showCreate = !showCreate">{{ showCreate ? "Close" : "New playbook" }}</button>
  </header>

  <form v-if="canEdit && showCreate" class="disclosure-form create-disclosure" @submit.prevent="createProcedure">
    <label for="procedure-title">Playbook name</label>
    <div class="form-row"><input id="procedure-title" v-model="procedureTitle" placeholder="Event setup" required maxlength="160"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !procedureTitle.trim()">{{ actionBusy === "create-procedure" ? "Creating…" : "Create" }}</button></div>
  </form>

  <div v-if="!activeProcedures.length" class="empty-page-state">
    <h2>{{ archivedProcedures.length ? "No active playbooks" : "Create the first playbook" }}</h2>
    <p>{{ archivedProcedures.length ? "Archived playbooks remain available below." : "Start with one recurring process and write the steps in the order people perform them." }}</p>
  </div>

  <div v-else class="playbook-workspace">
    <aside class="playbook-index" aria-label="Active playbooks">
      <button v-for="procedure in activeProcedures" :key="procedure.procedure" class="playbook-index-row" :class="{ selected: procedure.procedure === selectedProcedureId }" type="button" :aria-pressed="procedure.procedure === selectedProcedureId" @click="selectProcedure(procedure)">
        <span>{{ procedure.title }}</span><small>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</small>
      </button>
    </aside>

    <article v-if="selectedProcedure" class="playbook-document">
      <header class="document-header">
        <div class="document-title">
          <form v-if="canEdit && editingTitle === selectedProcedure.procedure" class="title-edit-form" @submit.prevent="renameProcedure(selectedProcedure)">
            <label class="sr-only" :for="`rename-${selectedProcedure.procedure}`">Rename {{ selectedProcedure.title }}</label><input :id="`rename-${selectedProcedure.procedure}`" v-model="titleDraft[selectedProcedure.procedure]" required maxlength="160"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !titleDraft[selectedProcedure.procedure]?.trim()">Save</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="editingTitle = ''">Cancel</button>
          </form>
          <template v-else><p class="document-label">Playbook</p><h2>{{ selectedProcedure.title }}</h2><p>{{ selectedProcedure.steps.length }} ordered {{ selectedProcedure.steps.length === 1 ? "step" : "steps" }} · {{ notesForProcedure(selectedProcedure.procedure).length }} context {{ notesForProcedure(selectedProcedure.procedure).length === 1 ? "note" : "notes" }}</p></template>
        </div>
        <details v-if="canEdit" class="action-menu"><summary aria-label="Playbook actions">Actions</summary><div><button type="button" @click="beginRename(selectedProcedure)">Rename</button><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('archive', selectedProcedure)">Archive</button></div></details>
      </header>

      <ol v-if="selectedProcedure.steps.length" class="document-steps">
        <li v-for="step in selectedProcedure.steps" :key="step.step" class="document-step">
          <span class="step-index">{{ step.position }}</span>
          <div class="step-body">
            <form v-if="canEdit && editingStep === step.step" class="step-edit-form" @submit.prevent="editStep(selectedProcedure, step)">
              <label class="sr-only" :for="`edit-${step.step}`">Edit step {{ step.position }}</label><textarea :id="`edit-${step.step}`" v-model="stepEditDraft[step.step]" required maxlength="500" rows="3"></textarea><div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !stepEditDraft[step.step]?.trim()">{{ actionBusy === `edit-${step.step}` ? "Saving…" : "Save" }}</button><button class="button button-small button-quiet" type="button" :disabled="!!actionBusy" @click="editingStep = ''">Cancel</button></div>
            </form>
            <template v-else>
              <p class="step-text">{{ step.text }}</p>
              <div class="step-tools"><button type="button" :aria-expanded="!!questionComposer[step.step]" @click="questionComposer[step.step] = !questionComposer[step.step]">Questions{{ questionsForStep(step.step).length ? ` (${questionsForStep(step.step).length})` : "" }}</button><details v-if="canEdit" class="action-menu step-menu"><summary :aria-label="`Actions for step ${step.position}`">Actions</summary><div><button type="button" :disabled="!!actionBusy || step.position === 1" @click="emit('moveStep', { procedure: selectedProcedure, step, position: step.position - 1 })">Move up</button><button type="button" :disabled="!!actionBusy || step.position === selectedProcedure.steps.length" @click="emit('moveStep', { procedure: selectedProcedure, step, position: step.position + 1 })">Move down</button><button type="button" :disabled="!!actionBusy" @click="beginEditStep(step)">Edit step</button><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('removeStep', { procedure: selectedProcedure, step })">Remove step</button></div></details></div>
            </template>
            <section v-if="questionComposer[step.step]" class="inline-disclosure" :aria-label="`Questions about step ${step.position}`">
              <div v-if="questionsForStep(step.step).length" class="subject-question-list"><article v-for="question in questionsForStep(step.step)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }"><strong>{{ question.status === "OPEN" ? "Awaiting answer" : "Answered" }}</strong><p>{{ question.text }}</p><p v-if="question.answer" class="question-answer"><span>Answer</span>{{ question.answer }}</p></article></div>
              <form class="question-form" @submit.prevent="askQuestion(selectedProcedure, step)"><label :for="`question-${step.step}`">Ask about this step</label><div class="form-row"><input :id="`question-${step.step}`" v-model="questionDraft[step.step]" placeholder="What needs clarification?" required maxlength="1000"><button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(questionDraft[step.step] ?? '').trim()">{{ actionBusy === `ask-step-${step.step}` ? "Sending…" : "Ask" }}</button></div></form>
            </section>
          </div>
        </li>
      </ol>
      <p v-else class="document-empty">No steps yet. Add the first instruction to make this playbook useful.</p>

      <div v-if="canEdit" class="add-step-control">
        <button v-if="!showAddStep" class="text-button" type="button" @click="showAddStep = true">Add a step</button>
        <form v-else class="disclosure-form" @submit.prevent="addStep(selectedProcedure)"><label :for="`step-${selectedProcedure.procedure}`">New step</label><textarea :id="`step-${selectedProcedure.procedure}`" v-model="stepDraft[selectedProcedure.procedure]" placeholder="Write one clear instruction…" required maxlength="500" rows="3"></textarea><div class="form-actions"><button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !(stepDraft[selectedProcedure.procedure] ?? '').trim()">{{ actionBusy === `step-${selectedProcedure.procedure}` ? "Adding…" : "Add step" }}</button><button class="button button-small button-quiet" type="button" @click="showAddStep = false">Cancel</button></div></form>
      </div>

      <section class="document-context"><h3>Attached context</h3><div v-if="notesForProcedure(selectedProcedure.procedure).length" class="context-callouts"><blockquote v-for="note in notesForProcedure(selectedProcedure.procedure)" :key="note.context">{{ note.text }}</blockquote></div><p v-else>No context notes are attached yet. The playbook can still stand on its own.</p></section>
    </article>
  </div>

  <details v-if="archivedProcedures.length" class="quiet-history archived-playbooks"><summary>Archived playbooks <span>{{ archivedProcedures.length }}</span></summary><article v-for="procedure in archivedProcedures" :key="procedure.procedure" class="archived-playbook"><header><strong>{{ procedure.title }}</strong><small>{{ procedure.steps.length }} steps</small></header><ol><li v-for="step in procedure.steps" :key="step.step"><span>{{ step.position }}</span>{{ step.text }}</li></ol><p>{{ notesForProcedure(procedure.procedure).length }} attached context notes. Review history remains available.</p></article></details>
</template>
