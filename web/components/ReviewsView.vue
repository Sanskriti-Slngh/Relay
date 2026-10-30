<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from "vue";
import type { Attachment, ContextNote, PendingReview, Procedure, ProcedureReviewHistory, ReviewCause, Step } from "../api.ts";
import { contextConnectionsForReview, contextScopeForReviewCause } from "../review-context.ts";
import { hasChangedDraft } from "../unsaved-work.ts";
import VersionConflict from "./VersionConflict.vue";

const props = defineProps<{ reviews: PendingReview[]; reviewHistory: ProcedureReviewHistory[]; procedures: Procedure[]; contexts: ContextNote[]; actionBusy: string; canEdit: boolean; canEditContext: boolean; focusReview?: string }>();
const emit = defineEmits<{
  confirm: [review: PendingReview];
  requireChanges: [review: PendingReview];
  resolve: [review: PendingReview];
  cancel: [review: PendingReview];
  editPlaybook: [review: PendingReview];
  editStep: [payload: { procedure: Procedure; step: Step; text: string; expectedVersion: number; onSuccess: () => void; review?: PendingReview }];
  replaceContext: [payload: { currentNote: ContextNote; attachment: Attachment; replacementNote?: ContextNote; text?: string; onSuccess: () => void; review?: PendingReview }];
  detachContext: [payload: { note: ContextNote; attachment: Attachment; onSuccess?: () => void; skipConfirmation?: boolean; review?: PendingReview }];
  openContext: [];
  dirtyChange: [dirty: boolean];
}>();

const finishedReviews = computed(() => props.reviewHistory.flatMap((procedure) => procedure.reviews.filter((review) => review.status === "COMPLETE" || review.status === "CANCELLED").map((review) => ({ ...review, procedure: procedure.procedure, title: procedure.title }))));
const dirtyReviews = reactive<Record<string, boolean>>({});
const expandedDiffs = reactive<Record<string, boolean>>({});
const preview = ref<{ review: PendingReview; focusStepId: string | null } | null>(null);
const stepRefs = new Map<string, HTMLElement>();

const editingStepId = ref("");
const stepDraft = ref("");
const stepVersion = ref(0);
const stepSaved = ref(false);
const manageAttachment = ref("");
const actionMode = ref<"replace" | "detach" | "">("");
const replacementMode = ref<"existing" | "new">("existing");
const replacementContext = ref("");
const newContextDraft = ref("");

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
function hasWholePlaybookContext(review: PendingReview) { return review.causes.some((cause) => causeScope(review, cause).wholePlaybook); }
function changedContextWasDetached(review: PendingReview) { return review.causes.some((cause) => { const scope = causeScope(review, cause); return scope.contextFound && !scope.found; }); }
function changedContextWasDeleted(review: PendingReview) { return review.causes.some((cause) => !causeScope(review, cause).contextFound); }
function affectedStepList(review: PendingReview) {
  const procedure = currentProcedure(review.procedure);
  if (!procedure) return [];
  if (hasWholePlaybookContext(review)) return procedure.steps;
  const ids = new Set(review.causes.flatMap((cause) => causeScope(review, cause).stepIds));
  return procedure.steps.filter(({ step }) => ids.has(step));
}
function affectedStepPositions(review: PendingReview) { return affectedStepList(review).map(({ position }) => position); }

type StepPill = { label: string; stepId: string | null };
function causeStepTargets(review: PendingReview, cause: ReviewCause): StepPill[] {
  const procedure = currentProcedure(review.procedure);
  const scope = causeScope(review, cause);
  const title = procedure?.title ?? review.title;
  if (scope.wholePlaybook) return [{ label: `${title} · Whole Playbook`, stepId: null }];
  if (!procedure) return [];
  return procedure.steps
    .filter(({ step }) => scope.stepIds.includes(step))
    .map((step) => ({ label: `${title} · Step ${step.position}`, stepId: step.step }));
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
function scopeLabel(review: PendingReview, cause: ReviewCause) {
  const scope = causeScope(review, cause);
  if (scope.contextFound && !scope.found) return "No longer attached to this Playbook";
  if (!scope.contextFound) return "Source Context Note no longer available";
  if (!scope.found) return "Attachment location unavailable";
  if (scope.wholePlaybook) return "Attached to the whole Playbook";
  return "";
}

type DiffToken = { type: "same" | "removed" | "added"; text: string };
function tokenize(text: string): string[] { return text ? text.match(/\s+|[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*|[^\s\w]+/g) ?? [] : []; }
function wordDiff(before: string, after: string): DiffToken[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: DiffToken[] = [];
  const ws = (text: string) => /^\s+$/.test(text);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: ws(a[i]) ? "same" : "removed", text: a[i] }); i++; }
    else { out.push({ type: ws(b[j]) ? "same" : "added", text: b[j] }); j++; }
  }
  while (i < m) { out.push({ type: ws(a[i]) ? "same" : "removed", text: a[i] }); i++; }
  while (j < n) { out.push({ type: ws(b[j]) ? "same" : "added", text: b[j] }); j++; }
  return out;
}
function diffFor(cause: ReviewCause) { return wordDiff(cause.before ?? "", cause.after ?? ""); }

function autoresize(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
function autoresizeEl(el: unknown) {
  if (!(el instanceof HTMLTextAreaElement)) return;
  requestAnimationFrame(() => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; });
}
function toggleDiff(key: string) { expandedDiffs[key] = !expandedDiffs[key]; }

function completeLabel(review: PendingReview) {
  if (actionBusyMatches(review, "confirm") || actionBusyMatches(review, "resolve")) return "Completing…";
  return "Complete Review";
}
function actionBusyMatches(review: PendingReview, prefix: string) { return props.actionBusy === `${prefix}-${review.review}`; }
function completeReview(review: PendingReview) {
  if (review.status === "CHANGES_REQUIRED") emit("resolve", review);
  else emit("confirm", review);
}
function openOther(review: PendingReview) {
  const firstStep = affectedStepList(review)[0]?.step ?? null;
  openPreview(review, firstStep);
}

function openContextPage() {
  if (modalDirty.value && !window.confirm("Discard the unsaved edit before leaving the Playbook preview?")) return;
  preview.value = null;
  resetModalState();
  stepRefs.clear();
  emit("openContext");
}


function openPreview(review: PendingReview, stepId: string | null) {
  preview.value = { review, focusStepId: stepId };
  resetModalState();
  nextTick(() => {
    if (!stepId) return;
    const el = stepRefs.get(stepId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
function closePreview() {
  if (modalDirty.value && !window.confirm("Discard the unsaved edit in the Playbook preview?")) return;
  preview.value = null;
  resetModalState();
  stepRefs.clear();
}
function registerStep(stepId: string, el: Element | null) {
  if (el instanceof HTMLElement) stepRefs.set(stepId, el);
  else stepRefs.delete(stepId);
}

const previewProcedure = computed(() => preview.value ? currentProcedure(preview.value.review.procedure) : undefined);
const previewAffectedStepIds = computed<Set<string>>(() => {
  if (!preview.value) return new Set();
  return new Set(preview.value.review.causes.flatMap((cause) => causeScope(preview.value!.review, cause).stepIds));
});
const previewWholePlaybook = computed(() => preview.value ? hasWholePlaybookContext(preview.value.review) : false);
const previewConnections = computed(() => preview.value ? contextConnectionsForReview(preview.value.review.causes.map(({ cause }) => cause), preview.value.review.procedure, props.contexts) : []);

function allAttachmentsForStep(stepId: string | null) {
  if (!preview.value) return [] as Array<{ note: ContextNote; attachment: Attachment; changed: boolean }>;
  const procedureId = preview.value.review.procedure;
  const changedIds = new Set(previewConnections.value.filter(({ attachment }) => attachment.anchor === stepId).map(({ attachment }) => attachment.attachment));
  const rows: Array<{ note: ContextNote; attachment: Attachment; changed: boolean }> = [];
  for (const note of props.contexts) {
    for (const attachment of note.attachments) {
      if (attachment.subject !== procedureId) continue;
      if (attachment.anchor !== stepId) continue;
      rows.push({ note, attachment, changed: changedIds.has(attachment.attachment) });
    }
  }
  return rows.sort((a, b) => (a.changed === b.changed ? 0 : a.changed ? -1 : 1));
}

function stepIsAffected(stepId: string) {
  return previewWholePlaybook.value || previewAffectedStepIds.value.has(stepId);
}

const modalDirty = computed(() => {
  if (!preview.value || !editingStepId.value) return (actionMode.value === "replace" && !!newContextDraft.value.trim());
  const procedure = previewProcedure.value;
  if (!procedure) return false;
  const step = procedure.steps.find(({ step }) => step === editingStepId.value);
  if (!step) return false;
  return !stepSaved.value && hasChangedDraft(step.text, [stepDraft.value]);
});
watch(modalDirty, (dirty) => {
  if (!preview.value) return;
  dirtyReviews[preview.value.review.review] = dirty;
});

function resetModalState() {
  editingStepId.value = "";
  stepDraft.value = "";
  stepVersion.value = 0;
  stepSaved.value = false;
  manageAttachment.value = "";
  actionMode.value = "";
  replacementMode.value = "existing";
  replacementContext.value = "";
  newContextDraft.value = "";
}
function startStepEdit(step: Step) {
  if (modalDirty.value && !window.confirm("Discard the unsaved edit before editing another Step?")) return;
  editingStepId.value = step.step;
  stepDraft.value = step.text;
  stepVersion.value = step.version;
  stepSaved.value = false;
}
function cancelStepEdit() {
  if (modalDirty.value && !window.confirm("Discard the unsaved Step edit?")) return;
  editingStepId.value = "";
  stepDraft.value = "";
  stepVersion.value = 0;
  stepSaved.value = false;
}
function saveStepEdit(step: Step) {
  if (!preview.value) return;
  const procedure = previewProcedure.value;
  const text = stepDraft.value.trim();
  if (!procedure || !text) return;
  emit("editStep", {
    procedure,
    step,
    text,
    expectedVersion: stepVersion.value || step.version,
    review: preview.value.review,
    onSuccess: () => {
      stepSaved.value = true;
      stepDraft.value = text;
      stepVersion.value = step.version;
    },
  });
}
function saveMyStep(step: Step) {
  stepVersion.value = step.version;
  saveStepEdit(step);
}

function startManage(attachmentId: string) {
  if (modalDirty.value && !window.confirm("Discard the unsaved edit before managing another attachment?")) return;
  manageAttachment.value = manageAttachment.value === attachmentId ? "" : attachmentId;
  actionMode.value = "";
  replacementMode.value = "existing";
  replacementContext.value = "";
  newContextDraft.value = "";
}
function chooseAttachmentAction(mode: "replace" | "detach") {
  if (actionMode.value === mode) { actionMode.value = ""; return; }
  actionMode.value = mode;
  replacementMode.value = "existing";
  replacementContext.value = "";
  newContextDraft.value = "";
}

const availableExistingContexts = computed(() => {
  if (!preview.value || !manageAttachment.value) return [];
  const connection = previewConnections.value.find(({ attachment }) => attachment.attachment === manageAttachment.value);
  if (!connection) return [];
  const anchor = connection.attachment.anchor;
  const procedureId = preview.value.review.procedure;
  return props.contexts.filter((note) =>
    note.context !== connection.note.context &&
    !note.attachments.some((attachment) => attachment.subject === procedureId && attachment.anchor === anchor),
  );
});
watch(availableExistingContexts, (notes) => {
  if (!notes.length && replacementMode.value === "existing") replacementMode.value = "new";
});

function submitReplace() {
  const connection = previewConnections.value.find(({ attachment }) => attachment.attachment === manageAttachment.value);
  if (!connection) return;
  const replacementNote = replacementMode.value === "existing"
    ? props.contexts.find(({ context }) => context === replacementContext.value)
    : undefined;
  const text = replacementMode.value === "new" ? newContextDraft.value.trim() : undefined;
  if ((!replacementNote && !text) || (replacementNote && text)) return;
  emit("replaceContext", {
    currentNote: connection.note,
    attachment: connection.attachment,
    replacementNote,
    text,
    review: preview.value?.review,
    onSuccess: () => {
      manageAttachment.value = "";
      actionMode.value = "";
      replacementContext.value = "";
      newContextDraft.value = "";
    },
  });
}
function submitDetach() {
  const connection = previewConnections.value.find(({ attachment }) => attachment.attachment === manageAttachment.value);
  if (!connection) return;
  emit("detachContext", {
    review: preview.value?.review,
    note: connection.note,
    attachment: connection.attachment,
    skipConfirmation: true,
    onSuccess: () => {
      manageAttachment.value = "";
      actionMode.value = "";
    },
  });
}

watch(() => props.procedures, () => {
  if (!editingStepId.value || !preview.value) return;
  const procedure = currentProcedure(preview.value.review.procedure);
  if (!procedure) return;
  const step = procedure.steps.find(({ step }) => step === editingStepId.value);
  if (!step || !stepSaved.value) return;
  stepDraft.value = step.text;
  stepVersion.value = step.version;
}, { deep: true });
</script>

<template>
  <header class="page-heading heading-with-action"><h1>Reviews</h1><span class="status-count" :class="{ attention: reviews.length }">{{ reviews.length }} open</span></header>

  <div v-if="!reviews.length" class="empty-page-state"><h2>All caught up</h2><p>No Playbooks need review right now. When shared information changes, affected Playbooks will appear here.</p></div>
  <div v-else class="inbox-list">
    <details v-for="review in reviews" :key="review.review" class="inbox-row" :open="review.review === focusReview">
      <summary><span class="status-dot pending-dot" aria-hidden="true"></span><span class="inbox-row-copy"><strong>{{ review.title }}</strong><small>{{ reviewSubtitle(review) }}</small></span><span class="row-status pending">{{ review.status === "PENDING" ? "Needs review" : "Needs updating" }}</span></summary>
      <div class="inbox-detail">
        <section class="review-changes" :aria-labelledby="`changes-${review.review}`">
          <h3 :id="`changes-${review.review}`">{{ review.causes.length === 1 ? "Context change" : `${review.causes.length} context changes` }}</h3>
          <div class="review-change-list">
            <article v-for="(cause, index) in review.causes" :key="cause.cause" class="review-change-card">
              <header class="review-change-card-head">
                <span class="change-index">Change {{ index + 1 }}</span>
                <p v-if="scopeLabel(review, cause)" class="change-scope">{{ scopeLabel(review, cause) }}</p>
              </header>
              <p class="change-diff">
                <template v-for="(token, tokenIndex) in diffFor(cause)" :key="tokenIndex"><span v-if="token.type === 'same'">{{ token.text }}</span><span v-else-if="token.type === 'removed'" class="diff-removed">{{ token.text }}</span><span v-else class="diff-added">{{ token.text }}</span></template>
              </p>
              <button type="button" class="change-expand" @click="toggleDiff(`${review.review}-${cause.cause}`)">{{ expandedDiffs[`${review.review}-${cause.cause}`] ? "Hide full text" : "Show full text" }}</button>
              <div v-if="expandedDiffs[`${review.review}-${cause.cause}`]" class="change-full">
                <div class="change-full-row"><span>Before</span><p>{{ cause.before }}</p></div>
                <div class="change-full-row change-full-after"><span>Now</span><p>{{ cause.after }}</p></div>
              </div>
              <div v-if="causeStepTargets(review, cause).length" class="change-affects">
                <span>Affects</span>
                <button v-for="target in causeStepTargets(review, cause)" :key="target.label" type="button" class="affect-chip affect-chip-button" @click="openPreview(review, target.stepId)">{{ target.label }}</button>
              </div>
              <p v-else-if="causeScope(review, cause).contextFound && !causeScope(review, cause).found" class="change-affects-note">No longer attached to this Playbook.</p>
              <p v-else-if="!causeScope(review, cause).contextFound" class="change-affects-note">Source Context Note no longer available.</p>
            </article>
            <p v-if="!review.causes.length" class="form-guidance">No cause text is available for this Review.</p>
          </div>
        </section>

        <div class="review-decision" :class="{ 'review-resolution': review.status === 'CHANGES_REQUIRED' }">
          <div class="review-actions">
            <button class="button button-primary" type="button" :disabled="!!actionBusy || (review.status === 'CHANGES_REQUIRED' && !procedureIsActive(review.procedure))" @click="completeReview(review)">{{ completeLabel(review) }}</button>
            <button class="button button-secondary" type="button" :disabled="!!actionBusy || !procedureIsActive(review.procedure)" @click="openOther(review)">Other</button>
          </div>
        </div>
        <p v-if="!procedureIsActive(review.procedure)" class="form-guidance review-unavailable-guidance">{{ review.status === "PENDING" ? "This Playbook is archived, so it cannot be edited. You can still mark its current instructions as correct, or use Other actions to cancel the Review." : "This Playbook is archived, so it cannot be edited or resolved. Use Other actions to cancel the Review." }}</p>
      </div>
    </details>
  </div>

  <div v-if="preview && previewProcedure" class="playbook-preview-overlay" role="dialog" aria-modal="true" :aria-label="`Preview of ${previewProcedure.title}`" @click.self="closePreview">
    <div class="playbook-preview">
      <header class="playbook-preview-head">
        <h2>{{ previewProcedure.title }}</h2>
        <button type="button" class="playbook-preview-close" aria-label="Close preview" @click="closePreview">×</button>
      </header>

      <div v-if="allAttachmentsForStep(null).length" class="playbook-preview-whole">
        <span v-if="previewWholePlaybook" class="affect-chip">Whole Playbook</span>
        <p v-if="previewWholePlaybook">A Context Note attached to the whole Playbook has changed. Edit Steps as needed, or Manage the whole-Playbook attachments below.</p>
        <div class="playbook-preview-whole-attachments">
          <div v-for="connection in allAttachmentsForStep(null)" :key="connection.attachment.attachment" class="attachment-row" :class="{ 'attachment-row-muted': !connection.changed }">
            <div class="attachment-row-text"><span>{{ connection.changed ? "Changed · Whole Playbook" : "Whole Playbook" }}</span><p>{{ connection.note.text }}</p></div>
            <button v-if="connection.changed && canEditContext" type="button" class="attachment-manage-btn" @click="startManage(connection.attachment.attachment)">{{ manageAttachment === connection.attachment.attachment ? "Close" : "Manage" }}</button>
            <div v-if="manageAttachment === connection.attachment.attachment" class="attachment-manage-panel">
              <nav class="attachment-manage-choices">
                <button type="button" :class="{ selected: actionMode === 'replace' }" @click="chooseAttachmentAction('replace')">Replace Context</button>
                <button type="button" :class="{ selected: actionMode === 'detach' }" @click="chooseAttachmentAction('detach')">Detach from Whole Playbook</button>
              </nav>
              <form v-if="actionMode === 'replace'" class="attachment-replace-form" @submit.prevent="submitReplace">
                <div class="context-mode" role="group" aria-label="Replacement source"><button type="button" :class="{ active: replacementMode === 'existing' }" :disabled="!availableExistingContexts.length" @click="replacementMode = 'existing'">Use existing</button><button type="button" :class="{ active: replacementMode === 'new' }" @click="replacementMode = 'new'">Write new</button></div>
                <template v-if="replacementMode === 'existing'"><select :id="`attach-existing-${connection.attachment.attachment}`" v-model="replacementContext" required><option value="" disabled>Choose a Context Note…</option><option v-for="note in availableExistingContexts" :key="note.context" :value="note.context">{{ note.text }}</option></select></template>
                <template v-else><textarea :id="`attach-new-${connection.attachment.attachment}`" :ref="autoresizeEl" v-model="newContextDraft" class="autoresize" required maxlength="4000" rows="1" placeholder="Record the replacement decision, constraint, or reason…" @input="autoresize"></textarea></template>
                <div class="form-actions"><button class="button button-primary context-primary" type="submit" :disabled="!!actionBusy || (replacementMode === 'existing' ? !replacementContext : !newContextDraft.trim())">{{ actionBusy.startsWith('replace-context-') ? "Replacing…" : "Replace attachment" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="actionMode = ''">Cancel</button></div>
              </form>
              <div v-else-if="actionMode === 'detach'" class="attachment-detach-confirm">
                <p><strong>Detach this Context from the Whole Playbook?</strong> The shared Note stays attached elsewhere.</p>
                <div class="form-actions"><button class="button button-secondary danger-text" type="button" :disabled="!!actionBusy" @click="submitDetach">{{ actionBusy === `detach-${connection.attachment.attachment}` ? "Detaching…" : "Detach" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="actionMode = ''">Cancel</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ol v-if="previewProcedure.steps.length" class="playbook-preview-steps">
        <li v-for="step in previewProcedure.steps" :key="step.step" :ref="(el) => registerStep(step.step, el as Element | null)" :class="{ affected: stepIsAffected(step.step), focused: preview?.focusStepId === step.step }">
          <span>Step {{ step.position }}</span>
          <div class="playbook-preview-step-body">
            <div v-if="editingStepId !== step.step" class="playbook-preview-step-row">
              <p class="playbook-preview-step-text">{{ step.text }}</p>
              <button v-if="stepIsAffected(step.step) && canEdit && procedureIsActive(preview!.review.procedure)" type="button" class="step-edit-icon" :disabled="!!actionBusy" aria-label="Edit instruction" @click="startStepEdit(step)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </div>
            <form v-else class="playbook-preview-step-editor" @submit.prevent="saveStepEdit(step)">
              <textarea :ref="autoresizeEl" v-model="stepDraft" class="autoresize" required maxlength="500" rows="1" @input="(event) => { stepSaved = false; autoresize(event); }"></textarea>
              <div class="form-actions">
                <button class="button button-primary" type="submit" :disabled="!!actionBusy || !stepDraft.trim() || !hasChangedDraft(step.text, [stepDraft])">{{ actionBusy === `edit-${step.step}` ? "Saving…" : "Save" }}</button>
                <button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="cancelStepEdit">Cancel</button>
                <p v-if="stepSaved" role="status" class="step-saved-note"><strong>Saved.</strong> Resolve the Review when every repair is handled.</p>
              </div>
              <VersionConflict v-if="!stepSaved && stepVersion !== step.version" subject="step" saved-label="Current saved instruction" :saved-value="step.text" draft-label="Your unsaved instruction" :draft-value="stepDraft" :busy="!!actionBusy" @use-saved="startStepEdit(step)" @save-mine="saveMyStep(step)" />
            </form>

            <div v-if="allAttachmentsForStep(step.step).length" class="playbook-preview-step-attachments">
              <div v-for="connection in allAttachmentsForStep(step.step)" :key="connection.attachment.attachment" class="attachment-row" :class="{ 'attachment-row-muted': !connection.changed }">
                <div class="attachment-row-text"><span>{{ connection.changed ? "Changed attachment" : "Attached Context" }}</span><p>{{ connection.note.text }}</p></div>
                <button v-if="connection.changed && canEditContext && procedureIsActive(preview!.review.procedure)" type="button" class="attachment-manage-btn" @click="startManage(connection.attachment.attachment)">{{ manageAttachment === connection.attachment.attachment ? "Close" : "Manage" }}</button>
                <div v-if="manageAttachment === connection.attachment.attachment" class="attachment-manage-panel">
                  <nav class="attachment-manage-choices">
                    <button type="button" :class="{ selected: actionMode === 'replace' }" @click="chooseAttachmentAction('replace')">Replace Context</button>
                    <button type="button" :class="{ selected: actionMode === 'detach' }" @click="chooseAttachmentAction('detach')">Detach from this Step</button>
                  </nav>
                  <form v-if="actionMode === 'replace'" class="attachment-replace-form" @submit.prevent="submitReplace">
                    <div class="context-mode" role="group" aria-label="Replacement source"><button type="button" :class="{ active: replacementMode === 'existing' }" :disabled="!availableExistingContexts.length" @click="replacementMode = 'existing'">Use existing</button><button type="button" :class="{ active: replacementMode === 'new' }" @click="replacementMode = 'new'">Write new</button></div>
                    <template v-if="replacementMode === 'existing'"><select :id="`attach-existing-${connection.attachment.attachment}`" v-model="replacementContext" required><option value="" disabled>Choose a Context Note…</option><option v-for="note in availableExistingContexts" :key="note.context" :value="note.context">{{ note.text }}</option></select></template>
                    <template v-else><textarea :id="`attach-new-${connection.attachment.attachment}`" :ref="autoresizeEl" v-model="newContextDraft" class="autoresize" required maxlength="4000" rows="1" placeholder="Record the replacement decision, constraint, or reason…" @input="autoresize"></textarea></template>
                    <div class="form-actions"><button class="button button-primary context-primary" type="submit" :disabled="!!actionBusy || (replacementMode === 'existing' ? !replacementContext : !newContextDraft.trim())">{{ actionBusy.startsWith('replace-context-') ? "Replacing…" : "Replace attachment" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="actionMode = ''">Cancel</button></div>
                  </form>
                  <div v-else-if="actionMode === 'detach'" class="attachment-detach-confirm">
                    <p><strong>Detach this Context from Step {{ step.position }}?</strong> The shared Note stays attached elsewhere.</p>
                    <div class="form-actions"><button class="button button-secondary danger-text" type="button" :disabled="!!actionBusy" @click="submitDetach">{{ actionBusy === `detach-${connection.attachment.attachment}` ? "Detaching…" : "Detach" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="actionMode = ''">Cancel</button></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ol>
      <p v-else class="playbook-preview-empty">This Playbook has no Steps.</p>

      <aside class="playbook-preview-global">
        <span class="review-global-badge">Global</span>
        <div class="playbook-preview-global-body">
          <p>Edits to the shared Context Note itself apply to every Playbook using it, so they live on the Context page — not here.</p>
          <button type="button" class="button button-small button-secondary" @click="openContextPage">Open Context page</button>
        </div>
      </aside>
    </div>
  </div>

  <details v-if="finishedReviews.length" class="quiet-history">
    <summary>Finished reviews <span>{{ finishedReviews.length }}</span></summary>
    <div class="finished-review-list">
      <details v-for="review in finishedReviews" :key="review.review" class="finished-review-row">
        <summary>
          <span class="finished-review-copy">
            <strong>{{ review.title }}</strong>
            <small>{{ review.causes.length }} {{ review.causes.length === 1 ? "change" : "changes" }}</small>
          </span>
          <span class="row-status" :class="review.status === 'COMPLETE' ? 'complete' : 'cancelled'">{{ review.status === "COMPLETE" ? "Complete" : "Cancelled" }}</span>
        </summary>
        <div class="finished-review-body">
          <article v-for="(cause, index) in review.causes" :key="cause.cause" class="finished-change-card">
            <span class="change-index">Change {{ index + 1 }}</span>
            <p class="change-diff">
              <template v-for="(token, tokenIndex) in diffFor(cause)" :key="tokenIndex"><span v-if="token.type === 'same'">{{ token.text }}</span><span v-else-if="token.type === 'removed'" class="diff-removed">{{ token.text }}</span><span v-else class="diff-added">{{ token.text }}</span></template>
            </p>
          </article>
        </div>
      </details>
    </div>
  </details>
</template>
