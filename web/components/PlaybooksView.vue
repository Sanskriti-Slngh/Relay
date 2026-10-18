<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { ContextNote, Procedure, Step, StepQuestion } from "../api.ts";

const props = defineProps<{
  procedures: Procedure[];
  contexts: ContextNote[];
  stepQuestions: StepQuestion[];
  actionBusy: string;
  canEdit: boolean;
}>();

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
const stepDraft = reactive<Record<string, string>>({});
const titleDraft = reactive<Record<string, string>>({});
const stepEditDraft = reactive<Record<string, string>>({});
const questionDraft = reactive<Record<string, string>>({});
const editingTitle = ref("");
const editingStep = ref("");
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const archivedProcedures = computed(() => props.procedures.filter(({ status }) => status === "RETIRED"));

function notesForProcedure(procedureId: string) {
  return props.contexts.filter((note) =>
    note.attachments.some((attachment) => attachment.subject === procedureId),
  );
}

function createProcedure() {
  const title = procedureTitle.value.trim();
  if (!title) return;
  emit("create", { title, onSuccess: () => { procedureTitle.value = ""; } });
}

function addStep(procedure: Procedure) {
  const text = (stepDraft[procedure.procedure] ?? "").trim();
  if (!text) return;
  emit("addStep", {
    procedure,
    text,
    onSuccess: () => { stepDraft[procedure.procedure] = ""; },
  });
}

function beginRename(procedure: Procedure) {
  titleDraft[procedure.procedure] = procedure.title;
  editingTitle.value = procedure.procedure;
}

function renameProcedure(procedure: Procedure) {
  const title = (titleDraft[procedure.procedure] ?? "").trim();
  if (!title) return;
  emit("rename", {
    procedure,
    title,
    onSuccess: () => { editingTitle.value = ""; },
  });
}

function beginEditStep(step: Step) {
  stepEditDraft[step.step] = step.text;
  editingStep.value = step.step;
}

function editStep(procedure: Procedure, step: Step) {
  const text = (stepEditDraft[step.step] ?? "").trim();
  if (!text) return;
  emit("editStep", {
    procedure,
    step,
    text,
    onSuccess: () => { editingStep.value = ""; },
  });
}

function questionsForStep(step: string) {
  return props.stepQuestions.filter((question) => question.step === step);
}

function askQuestion(procedure: Procedure, step: Step) {
  const text = (questionDraft[step.step] ?? "").trim();
  if (!text) return;
  emit("askQuestion", {
    procedure,
    step,
    text,
    onSuccess: () => { questionDraft[step.step] = ""; },
  });
}
</script>

<template>
  <div class="page-heading">
    <p class="eyebrow">REPEATABLE WORK, MADE CLEAR</p>
    <h1>Playbooks</h1>
    <p class="page-intro">Document how your club gets things done, one ordered step at a time.</p>
  </div>
  <form v-if="canEdit" class="create-bar" @submit.prevent="createProcedure">
    <label class="sr-only" for="procedure-title">New playbook title</label>
    <input id="procedure-title" v-model="procedureTitle" placeholder="Name a playbook…" required maxlength="160">
    <button class="button button-primary" type="submit" :disabled="!!actionBusy || !procedureTitle.trim()">
      {{ actionBusy === "create-procedure" ? "Creating…" : "Create playbook" }}
    </button>
  </form>
  <div v-if="!activeProcedures.length" class="panel empty-page-state">
    <span class="empty-icon">↗</span><h2>{{ archivedProcedures.length ? "No active playbooks" : "Your first playbook starts here" }}</h2>
    <p>{{ archivedProcedures.length ? "There are no active playbooks. Archived ones remain available below." : "Give it a clear name above, then add the steps your team follows." }}</p>
  </div>
  <div v-if="activeProcedures.length" class="procedure-list">
    <article v-for="procedure in activeProcedures" :key="procedure.procedure" class="panel procedure-card">
      <header class="procedure-card-heading">
        <span class="procedure-glyph large-glyph">P</span>
        <div class="procedure-title-group">
          <span class="eyebrow">PLAYBOOK</span>
          <form v-if="canEdit && editingTitle === procedure.procedure" class="title-edit-form" @submit.prevent="renameProcedure(procedure)">
            <label class="sr-only" :for="`rename-${procedure.procedure}`">Rename {{ procedure.title }}</label>
            <input :id="`rename-${procedure.procedure}`" v-model="titleDraft[procedure.procedure]" required maxlength="160">
            <button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !titleDraft[procedure.procedure]?.trim()">{{ actionBusy === `rename-${procedure.procedure}` ? "Saving…" : "Save" }}</button>
            <button class="button button-small button-secondary" type="button" :disabled="!!actionBusy" @click="editingTitle = ''">Cancel</button>
          </form>
          <div v-else class="title-display"><h2>{{ procedure.title }}</h2><button v-if="canEdit" class="text-button" type="button" :disabled="!!actionBusy" @click="beginRename(procedure)">Rename</button></div>
        </div>
        <span class="badge badge-active">Active</span>
      </header>
      <div class="steps-section">
        <div class="section-rule"><span>ORDERED STEPS</span><span>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</span></div>
        <ol v-if="procedure.steps.length" class="step-list">
          <li v-for="step in procedure.steps" :key="step.step" class="editable-step">
            <span class="step-index">{{ String(step.position).padStart(2, "0") }}</span>
            <form v-if="canEdit && editingStep === step.step" class="step-edit-form" @submit.prevent="editStep(procedure, step)">
              <label class="sr-only" :for="`edit-${step.step}`">Edit step {{ step.position }}</label>
              <input :id="`edit-${step.step}`" v-model="stepEditDraft[step.step]" required maxlength="500">
              <button class="button button-small button-primary" type="submit" :disabled="!!actionBusy || !stepEditDraft[step.step]?.trim()">{{ actionBusy === `edit-${step.step}` ? "Saving…" : "Save" }}</button>
              <button class="button button-small button-secondary" type="button" :disabled="!!actionBusy" @click="editingStep = ''">Cancel</button>
            </form>
            <template v-else>
              <span class="step-text">{{ step.text }}</span>
              <div v-if="canEdit" class="step-actions">
                <button class="step-action" type="button" :disabled="!!actionBusy || step.position === 1" :aria-label="`Move step ${step.position} up`" @click="emit('moveStep', { procedure, step, position: step.position - 1 })">↑</button>
                <button class="step-action" type="button" :disabled="!!actionBusy || step.position === procedure.steps.length" :aria-label="`Move step ${step.position} down`" @click="emit('moveStep', { procedure, step, position: step.position + 1 })">↓</button>
                <button class="text-button" type="button" :disabled="!!actionBusy" @click="beginEditStep(step)">Edit</button>
                <button class="text-button danger-text" type="button" :disabled="!!actionBusy" @click="emit('removeStep', { procedure, step })">Remove</button>
              </div>
            </template>
            <div class="step-question-area">
              <div v-if="questionsForStep(step.step).length" class="subject-question-list">
                <article v-for="question in questionsForStep(step.step)" :key="question.question" class="subject-question" :class="{ 'question-open': question.status === 'OPEN' }">
                  <strong>{{ question.status === "OPEN" ? "Awaiting officer answer" : "Answered" }}</strong>
                  <p>{{ question.text }}</p>
                  <p v-if="question.answer" class="question-answer"><span>Answer:</span> {{ question.answer }}</p>
                </article>
              </div>
              <form class="inline-form question-form" @submit.prevent="askQuestion(procedure, step)">
                <label class="sr-only" :for="`question-${step.step}`">Ask a question about step {{ step.position }}</label>
                <input :id="`question-${step.step}`" v-model="questionDraft[step.step]" placeholder="Ask about this step…" required maxlength="1000">
                <button class="button button-small button-secondary" type="submit" :disabled="!!actionBusy || !(questionDraft[step.step] ?? '').trim()">{{ actionBusy === `ask-step-${step.step}` ? "Sending…" : "Ask question" }}</button>
              </form>
            </div>
          </li>
        </ol>
        <p v-else class="subtle-empty">No steps added yet. Add the first one below.</p>
        <form v-if="canEdit" class="inline-form add-step-form" @submit.prevent="addStep(procedure)">
          <label class="sr-only" :for="`step-${procedure.procedure}`">New step for {{ procedure.title }}</label>
          <input :id="`step-${procedure.procedure}`" v-model="stepDraft[procedure.procedure]" placeholder="Describe the next step…" required maxlength="500">
          <button class="button button-secondary" type="submit" :disabled="!!actionBusy || !(stepDraft[procedure.procedure] ?? '').trim()">
            {{ actionBusy === `step-${procedure.procedure}` ? "Adding…" : "Add step" }}
          </button>
        </form>
      </div>
      <div class="associated-notes">
        <div class="section-rule"><span>CONNECTED CONTEXT</span><span>{{ notesForProcedure(procedure.procedure).length }}</span></div>
        <div v-if="notesForProcedure(procedure.procedure).length" class="associated-note-list">
          <p v-for="note in notesForProcedure(procedure.procedure)" :key="note.context"><span>“</span>{{ note.text }}</p>
        </div>
        <p v-else class="subtle-empty">Shared notes attached to this playbook will appear here.</p>
      </div>
      <footer v-if="canEdit" class="procedure-card-footer">
        <button class="button button-small button-secondary" type="button" :disabled="!!actionBusy" @click="emit('archive', procedure)">
          {{ actionBusy === `archive-${procedure.procedure}` ? "Archiving…" : "Archive playbook" }}
        </button>
      </footer>
    </article>
  </div>
  <details v-if="archivedProcedures.length" class="panel archived-playbooks">
    <summary>Archived playbooks <span class="badge badge-archived">{{ archivedProcedures.length }}</span></summary>
    <p class="archived-description">Archived playbooks are excluded from active lists. Their Steps, Context attachments, and Reviews are retained.</p>
    <article v-for="procedure in archivedProcedures" :key="procedure.procedure" class="archived-playbook">
      <div class="archived-playbook-heading"><strong>{{ procedure.title }}</strong><span class="badge badge-archived">Archived</span></div>
      <ol v-if="procedure.steps.length" class="step-list">
        <li v-for="step in procedure.steps" :key="step.step"><span class="step-index">{{ String(step.position).padStart(2, "0") }}</span><span>{{ step.text }}</span></li>
      </ol>
      <p v-else class="subtle-empty">This Playbook has no Steps.</p>
      <p class="archived-context-count">{{ notesForProcedure(procedure.procedure).length }} connected Context Notes · Review history remains available in Reviews.</p>
    </article>
  </details>
</template>
