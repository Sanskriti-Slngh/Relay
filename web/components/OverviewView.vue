<script setup lang="ts">
import { computed } from "vue";
import type { ContextNote, PendingReview, Procedure } from "../api.ts";
const props = defineProps<{ procedures: Procedure[]; contexts: ContextNote[]; reviews: PendingReview[]; unansweredCount: number; canEdit: boolean; canReview: boolean; canAnswer: boolean }>();
type OverviewTarget = { section: "procedures" | "context" | "reviews" | "questions"; procedure?: string };
const emit = defineEmits<{ navigate: [target: OverviewTarget] }>();
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const firstRun = computed(() => !activeProcedures.value.length && !props.contexts.length);
function playbookCountForNote(note: ContextNote) { return new Set(note.attachments.map(({ subject }) => subject)).size; }
</script>

<template>
  <header class="page-heading heading-with-action"><h1>Overview</h1><button v-if="canEdit && !firstRun" class="button button-primary" type="button" @click="emit('navigate', { section: 'procedures' })">New playbook</button></header>

  <section v-if="firstRun" class="first-run">
    <h2>Start with a playbook</h2><p>Choose one recurring task and write the steps in order.</p>
    <button v-if="canEdit" class="button button-primary" type="button" @click="emit('navigate', { section: 'procedures' })">Create your first playbook</button><p v-else>An Officer can add the first playbook.</p>
  </section>

  <template v-else>
  <section v-if="(canReview && reviews.length) || (canAnswer && unansweredCount)" class="attention-section">
    <h2>Needs attention</h2>
    <button v-if="canReview && reviews.length" class="attention-row" type="button" @click="emit('navigate', { section: 'reviews' })"><span><strong>{{ reviews.length }} {{ reviews.length === 1 ? "playbook to review" : "playbooks to review" }}</strong><small>Context changed</small></span><span>Review</span></button>
    <button v-if="canAnswer && unansweredCount" class="attention-row" type="button" @click="emit('navigate', { section: 'questions' })"><span><strong>{{ unansweredCount }} unanswered {{ unansweredCount === 1 ? "question" : "questions" }}</strong><small>Waiting for an answer</small></span><span>Answer</span></button>
  </section>
  <p v-else class="all-clear">All caught up.</p>

  <section class="overview-section">
    <header><div><h2>Playbooks</h2><p>{{ activeProcedures.length }} active</p></div><button class="text-button" type="button" @click="emit('navigate', { section: 'procedures' })">View all</button></header>
    <div v-if="activeProcedures.length" class="editorial-list"><button v-for="procedure in activeProcedures.slice(0, 5)" :key="procedure.procedure" type="button" @click="emit('navigate', { section: 'procedures', procedure: procedure.procedure })"><strong>{{ procedure.title }}</strong><span>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</span></button></div>
    <div v-else class="inline-empty"><p>No active playbooks yet.</p><button class="text-button" type="button" @click="emit('navigate', { section: 'procedures' })">Create one</button></div>
  </section>

  <section class="overview-section">
    <header><div><h2>Shared knowledge</h2><p>{{ contexts.length }} {{ contexts.length === 1 ? "note" : "notes" }}</p></div><button class="text-button" type="button" @click="emit('navigate', { section: 'context' })">View all</button></header>
    <div v-if="contexts.length" class="context-preview-list"><article v-for="note in contexts.slice(0, 3)" :key="note.context"><p>{{ note.text }}</p><small>Used by {{ playbookCountForNote(note) }} {{ playbookCountForNote(note) === 1 ? "playbook" : "playbooks" }}</small></article></div>
    <div v-else class="inline-empty"><p>No context notes yet.</p><button class="text-button" type="button" @click="emit('navigate', { section: 'context' })">Add context</button></div>
  </section>
  </template>
</template>
