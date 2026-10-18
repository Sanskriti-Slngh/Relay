<script setup lang="ts">
import { computed } from "vue";
import type { PendingReview, Procedure, ProcedureReviewHistory } from "../api.ts";

const props = defineProps<{ reviews: PendingReview[]; reviewHistory: ProcedureReviewHistory[]; procedures: Procedure[]; actionBusy: string; focusReview?: string }>();
const emit = defineEmits<{ confirm: [review: PendingReview]; requireChanges: [review: PendingReview]; resolve: [review: PendingReview]; cancel: [review: PendingReview]; editPlaybook: [review: PendingReview]; browseContext: [] }>();
const finishedReviews = computed(() => props.reviewHistory.flatMap((procedure) => procedure.reviews.filter((review) => review.status === "COMPLETE" || review.status === "CANCELLED").map((review) => ({ ...review, procedure: procedure.procedure, title: procedure.title }))));
function procedureIsActive(procedure: string) { return props.procedures.some((entry) => entry.procedure === procedure && entry.status === "ACTIVE"); }
</script>

<template>
  <header class="page-heading heading-with-action"><h1>Reviews</h1><span class="status-count" :class="{ attention: reviews.length }">{{ reviews.length }} open</span></header>

  <div v-if="!reviews.length" class="empty-page-state"><h2>No reviews</h2><button class="button button-secondary" type="button" @click="emit('browseContext')">View context</button></div>
  <div v-else class="inbox-list">
    <details v-for="review in reviews" :key="review.review" class="inbox-row" :open="review.review === focusReview">
      <summary><span class="status-dot pending-dot" aria-hidden="true"></span><span class="inbox-row-copy"><strong>{{ review.title }}</strong><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "context change" : "context changes" }}</small></span><span class="row-status pending">{{ review.status === "PENDING" ? "Review" : "Changes required" }}</span></summary>
      <div class="inbox-detail">
        <div class="cause-list"><article v-for="cause in review.causes" :key="cause.cause" class="cause-diff"><div><span>Before</span><p>{{ cause.before }}</p></div><div><span>After</span><p>{{ cause.after }}</p></div></article><p v-if="!review.causes.length" class="form-guidance">No cause text is available for this Review.</p></div>
        <div class="review-decision">
          <p v-if="review.status === 'PENDING'">Is this playbook still correct?</p><p v-else>Update the playbook, then resolve this review.</p>
          <div class="review-actions">
            <template v-if="review.status === 'PENDING'"><button class="button button-primary" type="button" :disabled="!!actionBusy" @click="emit('confirm', review)">{{ actionBusy === `confirm-${review.review}` ? "Confirming…" : "Confirm correct" }}</button><details class="action-menu"><summary>Other actions</summary><div><button type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('requireChanges', review)">Require changes</button><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('cancel', review)">Cancel review</button></div></details></template>
            <template v-else><button class="button button-secondary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('editPlaybook', review)">Edit playbook</button><button class="button button-primary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('resolve', review)">{{ actionBusy === `resolve-${review.review}` ? "Resolving…" : "Resolve review" }}</button><details class="action-menu"><summary>Other actions</summary><div><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('cancel', review)">Cancel review</button></div></details></template>
          </div>
        </div>
      </div>
    </details>
  </div>

  <details v-if="finishedReviews.length" class="quiet-history"><summary>Finished reviews <span>{{ finishedReviews.length }}</span></summary><div class="history-list"><article v-for="review in finishedReviews" :key="review.review" class="history-row"><header><div><strong>{{ review.title }}</strong><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "cause preserved" : "causes preserved" }}</small></div><span class="row-status" :class="review.status === 'COMPLETE' ? 'complete' : 'cancelled'">{{ review.status === "COMPLETE" ? "Complete" : "Cancelled" }}</span></header><div v-for="cause in review.causes" :key="cause.cause" class="history-change"><span>{{ cause.before }}</span><strong>{{ cause.after }}</strong></div></article></div></details>
</template>
