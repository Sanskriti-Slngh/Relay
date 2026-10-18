<script setup lang="ts">
import { computed } from "vue";
import type { ContextNote, PendingReview, Procedure } from "../api.ts";
const props = defineProps<{ procedures: Procedure[]; contexts: ContextNote[]; reviews: PendingReview[]; unansweredCount: number; canEdit: boolean; canReview: boolean; canAnswer: boolean }>();
const emit = defineEmits<{ navigate: [section: "procedures" | "context" | "reviews" | "questions"] }>();
const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
function notesForProcedure(id: string) { return props.contexts.filter((note) => note.attachments.some(({ subject }) => subject === id)); }
function playbookCountForNote(note: ContextNote) { return new Set(note.attachments.map(({ subject }) => subject)).size; }
</script>

<template>
  <header class="page-heading heading-with-action"><div><h1>Overview</h1><p class="page-intro">What needs attention, followed by the knowledge your club uses most.</p></div><button v-if="canEdit" class="button button-primary" type="button" @click="emit('navigate', 'procedures')">New playbook</button></header>

  <section v-if="(canReview && reviews.length) || (canAnswer && unansweredCount)" class="attention-section">
    <h2>Needs attention</h2>
    <button v-if="canReview && reviews.length" class="attention-row" type="button" @click="emit('navigate', 'reviews')"><span><strong>{{ reviews.length }} {{ reviews.length === 1 ? "playbook review" : "playbook reviews" }}</strong><small>Context changed and an Officer needs to check the official steps.</small></span><span>Review</span></button>
    <button v-if="canAnswer && unansweredCount" class="attention-row" type="button" @click="emit('navigate', 'questions')"><span><strong>{{ unansweredCount }} unanswered {{ unansweredCount === 1 ? "question" : "questions" }}</strong><small>Members are waiting for an Officer response.</small></span><span>Answer</span></button>
  </section>
  <p v-else class="all-clear">Nothing needs your attention right now.</p>

  <section class="overview-section">
    <header><div><h2>Playbooks</h2><p>{{ activeProcedures.length }} active</p></div><button class="text-button" type="button" @click="emit('navigate', 'procedures')">View all</button></header>
    <div v-if="activeProcedures.length" class="editorial-list"><button v-for="procedure in activeProcedures.slice(0, 5)" :key="procedure.procedure" type="button" @click="emit('navigate', 'procedures')"><strong>{{ procedure.title }}</strong><span>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }} · {{ notesForProcedure(procedure.procedure).length }} context {{ notesForProcedure(procedure.procedure).length === 1 ? "note" : "notes" }}</span></button></div>
    <div v-else class="inline-empty"><p>No active playbooks yet.</p><button class="text-button" type="button" @click="emit('navigate', 'procedures')">Create one</button></div>
  </section>

  <section class="overview-section">
    <header><div><h2>Shared knowledge</h2><p>{{ contexts.length }} {{ contexts.length === 1 ? "note" : "notes" }}</p></div><button class="text-button" type="button" @click="emit('navigate', 'context')">View all</button></header>
    <div v-if="contexts.length" class="context-preview-list"><article v-for="note in contexts.slice(0, 3)" :key="note.context"><p>{{ note.text }}</p><small>Used by {{ playbookCountForNote(note) }} {{ playbookCountForNote(note) === 1 ? "playbook" : "playbooks" }}</small></article></div>
    <div v-else class="inline-empty"><p>No context notes yet. Add one when the reasoning behind a step would help future members.</p><button class="text-button" type="button" @click="emit('navigate', 'context')">Open shared context</button></div>
  </section>
</template>
