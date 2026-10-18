<script setup lang="ts">
import { computed } from "vue";
import type { PendingReview, Procedure, ProcedureReviewHistory } from "../api.ts";

const props = defineProps<{
  reviews: PendingReview[];
  reviewHistory: ProcedureReviewHistory[];
  procedures: Procedure[];
  actionBusy: string;
}>();

const emit = defineEmits<{
  confirm: [review: PendingReview];
  requireChanges: [review: PendingReview];
  resolve: [review: PendingReview];
  cancel: [review: PendingReview];
  editPlaybook: [procedure: string];
  browseContext: [];
}>();

const finishedReviews = computed(() =>
  props.reviewHistory.flatMap((procedure) =>
    procedure.reviews
      .filter((review) => review.status === "COMPLETE" || review.status === "CANCELLED")
      .map((review) => ({ ...review, procedure: procedure.procedure, title: procedure.title })),
  ),
);

function procedureIsActive(procedure: string) {
  return props.procedures.some((entry) => entry.procedure === procedure && entry.status === "ACTIVE");
}
</script>

<template>
  <div class="page-heading heading-with-action">
    <div><p class="eyebrow">CLOSE THE LOOP</p><h1>Review inbox</h1><p class="page-intro">See what changed, understand the cause, and confirm when a playbook has been reconsidered.</p></div>
    <span class="inbox-count">{{ reviews.length }} pending</span>
  </div>
  <div class="review-context-banner"><span class="banner-icon">◷</span><p><strong>Meaningful changes create reviews.</strong> Each pending review includes the exact before-and-after text that prompted it.</p></div>
  <div v-if="!reviews.length" class="panel empty-page-state review-empty">
    <span class="empty-icon empty-icon-green">✓</span><h2>Your review inbox is clear</h2><p>When shared context changes in a way that affects a playbook, it will appear here.</p>
    <button class="button button-secondary" type="button" @click="emit('browseContext')">Browse shared context</button>
  </div>
  <div v-else class="review-list">
    <article v-for="review in reviews" :key="review.review" class="panel review-card">
      <div class="review-card-top">
        <div class="review-title-wrap"><span class="review-symbol" aria-hidden="true">↻</span><div><span class="eyebrow">PLAYBOOK REVIEW</span><h2>{{ review.title }}</h2><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "change" : "changes" }} to consider</small></div></div>
        <span class="badge badge-pending"><span class="pending-dot"></span> {{ review.status === "PENDING" ? "Pending" : "Changes required" }}</span>
      </div>
      <div class="causes-heading"><span>CAUSES</span><span>{{ review.causes.length }}</span></div>
      <article v-for="cause in review.causes" :key="cause.cause" class="cause-card">
        <div class="cause-label"><span class="cause-dot"></span> CONTEXT CHANGE</div>
        <div class="cause-diff"><div class="diff-before"><span>BEFORE</span><p>{{ cause.before }}</p></div><span class="diff-arrow" aria-hidden="true">→</span><div class="diff-after"><span>AFTER</span><p>{{ cause.after }}</p></div></div>
      </article>
      <div v-if="!review.causes.length" class="subtle-empty cause-empty">No cause text is available for this review.</div>
      <footer class="review-card-footer">
        <span v-if="review.status === 'PENDING'">Confirm it as current, or require edits before completion.</span>
        <span v-else>Update the affected active playbook, then resolve this review.</span>
        <div class="review-actions">
          <template v-if="review.status === 'PENDING'">
            <button class="button button-secondary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('requireChanges', review)">{{ actionBusy === `require-${review.review}` ? "Updating…" : "Require changes" }}</button>
            <button class="button button-primary" type="button" :disabled="!!actionBusy" @click="emit('confirm', review)">{{ actionBusy === `confirm-${review.review}` ? "Confirming…" : "Confirm correct" }} <span aria-hidden="true">✓</span></button>
          </template>
          <template v-else>
            <button class="button button-secondary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('editPlaybook', review.procedure)">Edit playbook</button>
            <button class="button button-primary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('resolve', review)">{{ actionBusy === `resolve-${review.review}` ? "Resolving…" : "Resolve review" }} <span aria-hidden="true">✓</span></button>
          </template>
          <button class="text-button danger-text" type="button" :disabled="!!actionBusy" @click="emit('cancel', review)">{{ actionBusy === `cancel-${review.review}` ? "Cancelling…" : "Cancel review" }}</button>
        </div>
      </footer>
    </article>
  </div>
  <section v-if="finishedReviews.length" class="panel completed-history">
    <div class="panel-heading"><div><p class="eyebrow">PRESERVED HISTORY</p><h2>Finished reviews</h2></div><span class="badge badge-complete">{{ finishedReviews.length }} finished</span></div>
    <article v-for="review in finishedReviews" :key="review.review" class="completed-review">
      <div class="completed-review-heading"><div><strong>{{ review.title }}</strong><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "cause preserved" : "causes preserved" }}</small></div><span class="badge" :class="review.status === 'COMPLETE' ? 'badge-complete' : 'badge-cancelled'">{{ review.status === "COMPLETE" ? "Complete" : "Cancelled" }}</span></div>
      <div v-for="cause in review.causes" :key="cause.cause" class="completed-cause"><span>{{ cause.before }}</span><span aria-hidden="true">→</span><strong>{{ cause.after }}</strong></div>
    </article>
  </section>
</template>
