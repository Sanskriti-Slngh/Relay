<script setup lang="ts">
import { computed, onUnmounted, reactive, watch } from "vue";
import type { Attachment, ContextNote, PendingReview, Procedure, ProcedureReviewHistory, ReviewCause, Step } from "../api.ts";
import { contextConnectionsForReview, contextScopeForReviewCause, stepForReviewRepair } from "../review-context.ts";
import ReviewRepairPanel from "./ReviewRepairPanel.vue";

const props = defineProps<{ reviews: PendingReview[]; reviewHistory: ProcedureReviewHistory[]; procedures: Procedure[]; contexts: ContextNote[]; actionBusy: string; canEdit: boolean; canEditContext: boolean; focusReview?: string }>();
const emit = defineEmits<{
  confirm: [review: PendingReview];
  requireChanges: [review: PendingReview];
  resolve: [review: PendingReview];
  cancel: [review: PendingReview];
  editPlaybook: [review: PendingReview];
  editStep: [payload: { procedure: Procedure; step: Step; text: string; expectedVersion: number; onSuccess: () => void }];
  replaceContext: [payload: { currentNote: ContextNote; attachment: Attachment; replacementNote?: ContextNote; text?: string; onSuccess: () => void }];
  detachContext: [payload: { note: ContextNote; attachment: Attachment; onSuccess?: () => void; skipConfirmation?: boolean }];
  dirtyChange: [dirty: boolean];
}>();
const finishedReviews = computed(() => props.reviewHistory.flatMap((procedure) => procedure.reviews.filter((review) => review.status === "COMPLETE" || review.status === "CANCELLED").map((review) => ({ ...review, procedure: procedure.procedure, title: procedure.title }))));
const dirtyReviews = reactive<Record<string, boolean>>({});
const hasUnsavedWork = computed(() => Object.values(dirtyReviews).some(Boolean));
watch(hasUnsavedWork, (dirty) => emit("dirtyChange", dirty), { immediate: true });
watch(() => props.reviews, (reviews) => {
  const current = new Set(reviews.map(({ review }) => review));
  for (const review of Object.keys(dirtyReviews)) if (!current.has(review)) delete dirtyReviews[review];
});
onUnmounted(() => emit("dirtyChange", false));

function procedureIsActive(procedure: string) { return props.procedures.some((entry) => entry.procedure === procedure && entry.status === "ACTIVE"); }
function currentProcedure(procedure: string) { return props.procedures.find((entry) => entry.procedure === procedure); }
function causeScope(review: PendingReview, cause: ReviewCause) { return contextScopeForReviewCause(cause.cause, review.procedure, props.contexts); }
function affectedSteps(review: PendingReview) { return new Set(review.causes.flatMap((cause) => causeScope(review, cause).stepIds)); }
function hasWholePlaybookContext(review: PendingReview) { return review.causes.some((cause) => causeScope(review, cause).wholePlaybook); }
function hasAffectedSteps(review: PendingReview) { return affectedSteps(review).size > 0; }
function changedContextWasDetached(review: PendingReview) { return review.causes.some((cause) => { const scope = causeScope(review, cause); return scope.contextFound && !scope.found; }); }
function changedContextWasDeleted(review: PendingReview) { return review.causes.some((cause) => !causeScope(review, cause).contextFound); }
function affectedStepList(review: PendingReview) {
  const procedure = currentProcedure(review.procedure);
  if (!procedure) return [];
  if (hasWholePlaybookContext(review)) return procedure.steps;
  const ids = affectedSteps(review);
  return procedure.steps.filter(({ step }) => ids.has(step));
}
function affectedStepPositions(review: PendingReview) { return affectedStepList(review).map(({ position }) => position); }
function hasInlineStepEditor(review: PendingReview) {
  const procedure = currentProcedure(review.procedure);
  if (!procedure || procedure.status !== "ACTIVE" || !props.canEdit) return false;
  const connection = contextConnectionsForReview(review.causes.map(({ cause }) => cause), review.procedure, props.contexts)[0];
  return !!connection && !!stepForReviewRepair(connection.attachment.anchor, procedure.steps);
}
function fallbackInstructions(review: PendingReview) {
  const affected = affectedStepList(review);
  return affected.length ? affected : currentProcedure(review.procedure)?.steps ?? [];
}
function reviewSubtitle(review: PendingReview) {
  const changeLabel = `${review.causes.length} context ${review.causes.length === 1 ? "change" : "changes"}`;
  if (hasWholePlaybookContext(review)) return review.status === "CHANGES_REQUIRED" ? `Whole Playbook affected · ${changeLabel}` : `${changeLabel} · Affects the whole Playbook`;
  const positions = affectedStepPositions(review);
  if (positions.length) {
    const scope = positions.length === 1 ? `Step ${positions[0]}` : `Steps ${positions.join(", ")}`;
    return review.status === "CHANGES_REQUIRED" ? `${scope} affected · ${changeLabel}` : `${changeLabel} · Affects ${scope}`;
  }
  if (changedContextWasDetached(review)) return `${changeLabel} · Source is no longer attached`;
  if (changedContextWasDeleted(review)) return `${changeLabel} · Source Note is no longer available`;
  return `${changeLabel} · Attachment location unavailable`;
}
function affectedInstructionsHeading(review: PendingReview) { return affectedStepList(review).length === 1 ? "Affected instruction" : "Affected instructions"; }
function scopeLabel(review: PendingReview, cause: ReviewCause) {
  const scope = causeScope(review, cause);
  if (scope.contextFound && !scope.found) return "No longer attached to this Playbook";
  if (!scope.contextFound) return "Source Context Note no longer available";
  if (!scope.found) return "Attachment location unavailable";

  const procedure = currentProcedure(review.procedure);
  const positions = scope.stepIds
    .map((stepId) => procedure?.steps.find((step) => step.step === stepId)?.position)
    .filter((position): position is number => position !== undefined)
    .sort((first, second) => first - second);
  const stepLabel = positions.length === 1 ? `Step ${positions[0]}` : positions.length ? `Steps ${positions.join(", ")}` : "";
  if (scope.wholePlaybook && stepLabel) return `Attached to the whole Playbook and ${stepLabel}`;
  if (scope.wholePlaybook) return "Attached to the whole Playbook";
  if (stepLabel) return `Attached to ${stepLabel}`;
  return "Attached Step is no longer available";
}
</script>

<template>
  <header class="page-heading heading-with-action"><h1>Reviews</h1><span class="status-count" :class="{ attention: reviews.length }">{{ reviews.length }} open</span></header>

  <div v-if="!reviews.length" class="empty-page-state"><h2>All caught up</h2><p>No Playbooks need review right now. When shared information changes, affected Playbooks will appear here.</p></div>
  <div v-else class="inbox-list">
    <details v-for="review in reviews" :key="review.review" class="inbox-row" :open="review.review === focusReview">
      <summary><span class="status-dot pending-dot" aria-hidden="true"></span><span class="inbox-row-copy"><strong>{{ review.title }}</strong><small>{{ reviewSubtitle(review) }}</small></span><span class="row-status pending">{{ review.status === "PENDING" ? "Needs review" : "Needs updating" }}</span></summary>
      <div class="inbox-detail">
        <section v-if="review.status === 'PENDING'" class="review-evidence" :aria-labelledby="`evidence-${review.review}`">
          <h3 :id="`evidence-${review.review}`">What changed?</h3>
          <div class="cause-list"><article v-for="cause in review.causes" :key="cause.cause" class="cause-diff review-cause-card"><p class="context-attachment-label">{{ scopeLabel(review, cause) }}</p><div class="evidence-before"><span>Before</span><p>{{ cause.before }}</p></div><div class="evidence-after"><span>Now</span><p>{{ cause.after }}</p></div></article><p v-if="!review.causes.length" class="form-guidance">No cause text is available for this Review.</p></div>
        </section>
        <section v-else class="review-change-summary" :aria-label="`${review.causes.length} changed Context ${review.causes.length === 1 ? 'Note' : 'Notes'}`">
          <article v-for="cause in review.causes" :key="cause.cause" class="review-change-row">
            <div><span>{{ scopeLabel(review, cause) }}</span><p>{{ cause.after }}</p></div>
            <details><summary>View change</summary><div class="review-change-detail"><div class="evidence-before"><span>Before</span><p>{{ cause.before }}</p></div><div class="evidence-after"><span>Now</span><p>{{ cause.after }}</p></div></div></details>
          </article>
          <p v-if="!review.causes.length" class="form-guidance">No cause text is available for this Review.</p>
        </section>
        <section v-if="review.status === 'PENDING'" class="review-instructions" :aria-labelledby="`instructions-${review.review}`">
          <h3 :id="`instructions-${review.review}`">{{ affectedInstructionsHeading(review) }}</h3>
          <p v-if="hasWholePlaybookContext(review)" class="review-scope-note whole-playbook-context">This Context applies to the whole Playbook, so every instruction remains available below.</p>
          <p v-else-if="hasAffectedSteps(review)" class="review-scope-note">These Steps use the changed Context.</p>
          <p v-else-if="changedContextWasDetached(review)" class="review-scope-note">The changed Context is no longer attached. Its before-and-after evidence is preserved above.</p>
          <p v-else-if="changedContextWasDeleted(review)" class="review-scope-note">The source Context Note was deleted. Its before-and-after evidence is preserved above.</p>
          <p v-else class="review-scope-note">The original attachment location is no longer available.</p>
          <ol v-if="affectedStepList(review).length" class="review-step-list affected-only">
            <li v-for="step in affectedStepList(review)" :key="step.step" class="context-affected-step"><span>Step {{ step.position }}</span><p>{{ step.text }}</p></li>
          </ol>
          <p v-else-if="!currentProcedure(review.procedure)?.steps.length" class="review-empty-instructions">This Playbook has no current Steps.</p>
          <details v-if="currentProcedure(review.procedure)?.steps.length && !hasWholePlaybookContext(review)" class="review-all-steps"><summary>View all steps</summary><ol class="review-step-list"><li v-for="step in currentProcedure(review.procedure)?.steps" :key="step.step"><span>Step {{ step.position }}</span><p>{{ step.text }}</p></li></ol></details>
        </section>
        <section v-else-if="!hasInlineStepEditor(review)" class="review-instructions review-readonly-fallback" :aria-labelledby="`instructions-${review.review}`">
          <h3 :id="`instructions-${review.review}`">Current {{ fallbackInstructions(review).length === 1 ? "instruction" : "instructions" }}</h3>
          <ol v-if="fallbackInstructions(review).length" class="review-step-list affected-only"><li v-for="step in fallbackInstructions(review)" :key="step.step"><span>Step {{ step.position }}</span><p>{{ step.text }}</p></li></ol>
          <p v-else class="review-empty-instructions">This Playbook has no current Steps.</p>
        </section>
        <ReviewRepairPanel v-if="review.status === 'CHANGES_REQUIRED' && currentProcedure(review.procedure)?.status === 'ACTIVE'" :review="review" :procedure="currentProcedure(review.procedure)!" :contexts="contexts" :action-busy="actionBusy" :can-edit="canEdit" :can-edit-context="canEditContext" @edit-step="emit('editStep', $event)" @replace-context="emit('replaceContext', $event)" @detach-context="emit('detachContext', $event)" @edit-playbook="emit('editPlaybook', $event)" @dirty-change="dirtyReviews[review.review] = $event" />
        <div class="review-decision" :class="{ 'review-resolution': review.status === 'CHANGES_REQUIRED' }">
          <div><h3>{{ review.status === "PENDING" ? "Do these instructions need to change?" : "Ready to finish?" }}</h3><p v-if="review.status === 'CHANGES_REQUIRED'">Resolve when the instructions are correct.</p></div>
          <div class="review-actions">
            <template v-if="review.status === 'PENDING'"><button class="review-choice" type="button" :disabled="!!actionBusy" @click="emit('confirm', review)"><strong>{{ actionBusy === `confirm-${review.review}` ? "Confirming…" : "Still correct" }}</strong><small>No instruction changes needed</small></button><button class="review-choice" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('requireChanges', review)"><strong>{{ actionBusy === `require-${review.review}` ? "Saving…" : "Needs updating" }}</strong><small>Open options to fix this Playbook</small></button><details class="action-menu review-cancel-menu"><summary>Other actions</summary><div><p>Cancel closes this task without confirming or updating the Playbook. It does not undo the Context change.</p><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('cancel', review)">Cancel without a decision</button></div></details></template>
            <template v-else><button class="button button-primary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="emit('resolve', review)">{{ actionBusy === `resolve-${review.review}` ? "Resolving…" : "Resolve review" }}</button><details class="action-menu review-cancel-menu"><summary>Other actions</summary><div><p>Cancel closes this task without confirming or updating the Playbook. It does not undo the Context change.</p><button class="danger-text" type="button" :disabled="!!actionBusy" @click="emit('cancel', review)">Cancel review</button></div></details></template>
          </div>
        </div>
        <p v-if="!procedureIsActive(review.procedure)" class="form-guidance review-unavailable-guidance">{{ review.status === "PENDING" ? "This Playbook is archived, so it cannot be edited. You can still mark its current instructions as correct, or use Other actions to cancel the Review." : "This Playbook is archived, so it cannot be edited or resolved. Use Other actions to cancel the Review." }}</p>
      </div>
    </details>
  </div>

  <details v-if="finishedReviews.length" class="quiet-history"><summary>Finished reviews <span>{{ finishedReviews.length }}</span></summary><div class="history-list"><article v-for="review in finishedReviews" :key="review.review" class="history-row"><header><div><strong>{{ review.title }}</strong><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "cause preserved" : "causes preserved" }}</small></div><span class="row-status" :class="review.status === 'COMPLETE' ? 'complete' : 'cancelled'">{{ review.status === "COMPLETE" ? "Complete" : "Cancelled" }}</span></header><div v-for="cause in review.causes" :key="cause.cause" class="history-change"><span>{{ cause.before }}</span><strong>{{ cause.after }}</strong></div></article></div></details>
</template>
