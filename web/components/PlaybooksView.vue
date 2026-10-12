<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { ContextNote, Procedure } from "../api.ts";

const props = defineProps<{
  procedures: Procedure[];
  contexts: ContextNote[];
  actionBusy: string;
}>();

const emit = defineEmits<{
  create: [payload: { title: string; onSuccess: () => void }];
  addStep: [payload: { procedure: Procedure; text: string; onSuccess: () => void }];
  archive: [procedure: Procedure];
}>();

const procedureTitle = ref("");
const stepDraft = reactive<Record<string, string>>({});
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
</script>

<template>
  <div class="page-heading">
    <p class="eyebrow">REPEATABLE WORK, MADE CLEAR</p>
    <h1>Playbooks</h1>
    <p class="page-intro">Document how your club gets things done, one ordered step at a time.</p>
  </div>
  <form class="create-bar" @submit.prevent="createProcedure">
    <label class="sr-only" for="procedure-title">New playbook title</label>
    <input id="procedure-title" v-model="procedureTitle" placeholder="Name a playbook…" required maxlength="160">
    <button class="button button-primary" type="submit" :disabled="actionBusy === 'create-procedure' || !procedureTitle.trim()">
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
        <div class="procedure-title-group"><span class="eyebrow">PLAYBOOK</span><h2>{{ procedure.title }}</h2></div>
        <span class="badge badge-active">Active</span>
      </header>
      <div class="steps-section">
        <div class="section-rule"><span>ORDERED STEPS</span><span>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</span></div>
        <ol v-if="procedure.steps.length" class="step-list">
          <li v-for="step in procedure.steps" :key="step.step">
            <span class="step-index">{{ String(step.position).padStart(2, "0") }}</span><span>{{ step.text }}</span>
          </li>
        </ol>
        <p v-else class="subtle-empty">No steps added yet. Add the first one below.</p>
        <form class="inline-form add-step-form" @submit.prevent="addStep(procedure)">
          <label class="sr-only" :for="`step-${procedure.procedure}`">New step for {{ procedure.title }}</label>
          <input :id="`step-${procedure.procedure}`" v-model="stepDraft[procedure.procedure]" placeholder="Describe the next step…" required maxlength="500">
          <button class="button button-secondary" type="submit" :disabled="actionBusy === `step-${procedure.procedure}` || !(stepDraft[procedure.procedure] ?? '').trim()">
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
      <footer class="procedure-card-footer">
        <button class="button button-small button-secondary" type="button" :disabled="actionBusy === `archive-${procedure.procedure}`" @click="emit('archive', procedure)">
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
