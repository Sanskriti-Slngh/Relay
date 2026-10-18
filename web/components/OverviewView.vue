<script setup lang="ts">
import { computed } from "vue";
import type { ContextNote, PendingReview, Procedure } from "../api.ts";

const props = defineProps<{
  procedures: Procedure[];
  contexts: ContextNote[];
  reviews: PendingReview[];
  unansweredCount: number;
  canEdit: boolean;
  canReview: boolean;
  canAnswer: boolean;
}>();

const emit = defineEmits<{
  navigate: [section: "procedures" | "context" | "reviews" | "questions"];
}>();

const activeProcedures = computed(() =>
  props.procedures.filter((procedure) => procedure.status === "ACTIVE"),
);
const archivedProcedures = computed(() =>
  props.procedures.filter((procedure) => procedure.status === "RETIRED"),
);

function notesForProcedure(procedureId: string) {
  return props.contexts.filter((note) =>
    note.attachments.some((attachment) => attachment.subject === procedureId),
  );
}

function playbookCountForNote(note: ContextNote) {
  return new Set(note.attachments.map(({ subject }) => subject)).size;
}
</script>

<template>
  <div class="page-heading heading-with-action">
    <div>
      <p class="eyebrow">YOUR CLUB, IN SYNC</p>
      <h1>Good to have you back.</h1>
      <p class="page-intro">A clear view of your club’s playbooks, shared context, and decisions to revisit.</p>
    </div>
    <button v-if="canEdit" class="button button-primary" type="button" @click="emit('navigate', 'procedures')">
      <span aria-hidden="true">＋</span> New playbook
    </button>
  </div>

  <div class="metric-grid" aria-label="Workspace summary">
    <article class="metric-card">
      <div class="metric-label"><span class="metric-icon icon-violet">↗</span> PLAYBOOKS</div>
      <strong>{{ activeProcedures.length }}</strong>
      <span class="metric-foot">{{ activeProcedures.length === 1 ? "active procedure" : "active procedures" }}</span>
    </article>
    <article class="metric-card">
      <div class="metric-label"><span class="metric-icon icon-blue">▤</span> SHARED CONTEXT</div>
      <strong>{{ contexts.length }}</strong>
      <span class="metric-foot">notes kept with the work</span>
    </article>
    <article v-if="canReview" class="metric-card" :class="{ 'metric-attention': reviews.length > 0 }">
      <div class="metric-label"><span class="metric-icon icon-amber">◷</span> PENDING REVIEWS</div>
      <strong>{{ reviews.length }}</strong>
      <span class="metric-foot">{{ reviews.length ? "ready for officer review" : "nothing waiting right now" }}</span>
    </article>
    <article v-if="canAnswer" class="metric-card" :class="{ 'metric-attention': unansweredCount > 0 }">
      <div class="metric-label"><span class="metric-icon icon-amber">?</span> UNANSWERED QUESTIONS</div>
      <strong>{{ unansweredCount }}</strong>
      <button class="text-button metric-foot" type="button" @click="emit('navigate', 'questions')">{{ unansweredCount ? "open officer inbox" : "nothing waiting right now" }}</button>
    </article>
  </div>

  <div class="overview-grid">
    <section class="panel panel-large">
      <div class="panel-heading">
        <div><p class="eyebrow">THE WAY YOU WORK</p><h2>Playbooks</h2></div>
        <button class="text-button" type="button" @click="emit('navigate', 'procedures')">All playbooks <span>→</span></button>
      </div>
      <div v-if="!activeProcedures.length" class="empty-state compact-empty">
        <span class="empty-icon">↗</span>
        <h3>{{ archivedProcedures.length ? "No active playbooks" : "Start with a playbook" }}</h3>
        <p>{{ archivedProcedures.length ? "Archived playbooks remain available below and in review history." : "Capture the repeatable steps your club relies on." }}</p>
        <button class="button button-secondary" type="button" @click="emit('navigate', 'procedures')">Create a playbook</button>
      </div>
      <div v-else class="overview-procedures">
        <article v-for="procedure in activeProcedures.slice(0, 4)" :key="procedure.procedure" class="overview-procedure">
          <span class="procedure-glyph">P</span>
          <div class="procedure-summary">
            <strong>{{ procedure.title }}</strong>
            <small>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }} <span>·</span> {{ notesForProcedure(procedure.procedure).length }} context notes</small>
          </div>
          <span class="badge badge-active">Active</span>
        </article>
      </div>
    </section>

    <section v-if="canReview" class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">NEEDS A LOOK</p><h2>Reviews</h2></div>
        <button class="text-button" type="button" @click="emit('navigate', 'reviews')">Open inbox <span>→</span></button>
      </div>
      <div v-if="!reviews.length" class="empty-state compact-empty">
        <span class="empty-icon empty-icon-green">✓</span>
        <h3>All caught up</h3>
        <p>No playbooks need a review.</p>
      </div>
      <div v-else class="review-preview-list">
        <article v-for="review in reviews.slice(0, 3)" :key="review.review" class="review-preview">
          <span class="review-marker"></span>
          <div><strong>{{ review.title }}</strong><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "change" : "changes" }} to consider</small></div>
          <span class="badge badge-pending">Pending</span>
        </article>
      </div>
    </section>
  </div>

  <section class="panel context-overview">
    <div class="panel-heading">
      <div><p class="eyebrow">KNOWLEDGE THAT TRAVELS</p><h2>Shared context preview</h2></div>
      <button class="text-button" type="button" @click="emit('navigate', 'context')">View context <span>→</span></button>
    </div>
    <div v-if="!contexts.length" class="empty-inline">No shared context notes yet. Add the background that helps your playbooks make sense.</div>
    <div v-else class="context-preview-grid">
      <article v-for="note in contexts.slice(0, 3)" :key="note.context" class="context-preview-card">
        <span class="note-mark">“</span>
        <p>{{ note.text }}</p>
        <small>{{ playbookCountForNote(note) }} {{ playbookCountForNote(note) === 1 ? "playbook" : "playbooks" }} <span>·</span> {{ note.changes.length }} recorded changes</small>
      </article>
    </div>
  </section>
  <footer class="page-footer">Relay keeps club knowledge connected to the work it informs.</footer>
</template>
