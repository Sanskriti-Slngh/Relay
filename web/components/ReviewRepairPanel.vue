<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { Attachment, ContextNote, PendingReview, Procedure, Step } from "../api.ts";
import { contextConnectionsForReview } from "../review-context.ts";
import { hasChangedDraft } from "../unsaved-work.ts";
import VersionConflict from "./VersionConflict.vue";

const props = defineProps<{
  review: PendingReview;
  procedure: Procedure;
  contexts: ContextNote[];
  actionBusy: string;
  canEdit: boolean;
  canEditContext: boolean;
}>();
const emit = defineEmits<{
  editStep: [payload: { procedure: Procedure; step: Step; text: string; expectedVersion: number; onSuccess: () => void }];
  replaceContext: [payload: { currentNote: ContextNote; attachment: Attachment; replacementNote?: ContextNote; text?: string; onSuccess: () => void }];
  detachContext: [payload: { note: ContextNote; attachment: Attachment; onSuccess?: () => void; skipConfirmation?: boolean }];
  editPlaybook: [review: PendingReview];
  dirtyChange: [dirty: boolean];
}>();

const selectedAttachment = ref("");
const selectedAnchor = ref<string | null | undefined>(undefined);
const actionMode = ref<"replace" | "remove" | "edit" | "">("");
const replacementMode = ref<"existing" | "new">("existing");
const replacementContext = ref("");
const newContextDraft = ref("");
const editStepId = ref("");
const stepDraft = ref("");
const stepVersion = ref(0);

const connections = computed(() => contextConnectionsForReview(
  props.review.causes.map(({ cause }) => cause),
  props.review.procedure,
  props.contexts,
));
const selectedConnection = computed(() => connections.value.find(({ attachment }) => attachment.attachment === selectedAttachment.value));
const targetStep = computed(() => selectedAnchor.value ? props.procedure.steps.find(({ step }) => step === selectedAnchor.value) : undefined);
const editTargetStep = computed(() => props.procedure.steps.find(({ step }) => step === editStepId.value));
const contextsAtTarget = computed(() => props.contexts.filter((note) => note.attachments.some((attachment) =>
  attachment.subject === props.procedure.procedure && attachment.anchor === (selectedAnchor.value ?? null),
)));
const availableExistingContexts = computed(() => props.contexts.filter((note) =>
  note.context !== selectedConnection.value?.note.context &&
  !note.attachments.some((attachment) => attachment.subject === props.procedure.procedure && attachment.anchor === (selectedAnchor.value ?? null)),
));
const dirty = computed(() =>
  (actionMode.value === "replace" && !!newContextDraft.value.trim()) ||
  (actionMode.value === "edit" && !!editTargetStep.value && hasChangedDraft(editTargetStep.value.text, [stepDraft.value])),
);

watch(connections, (next) => {
  if (next.some(({ attachment }) => attachment.attachment === selectedAttachment.value)) return;
  if (!selectedAttachment.value && selectedAnchor.value !== undefined) return;
  const first = next[0];
  selectedAttachment.value = first?.attachment.attachment ?? "";
  if (first) selectedAnchor.value = first.attachment.anchor;
}, { immediate: true });
watch(dirty, (value) => emit("dirtyChange", value), { immediate: true });
onUnmounted(() => emit("dirtyChange", false));

function targetLabel(anchor: string | null) {
  if (anchor === null) return "Whole Playbook";
  const step = props.procedure.steps.find(({ step }) => step === anchor);
  return step ? `Step ${step.position}` : "Removed Step";
}
function chooseConnection(attachment: Attachment) {
  if (dirty.value && !window.confirm("Discard the unsaved Review update before choosing another Context connection?")) return;
  selectedAttachment.value = attachment.attachment;
  selectedAnchor.value = attachment.anchor;
  resetAction();
}
function chooseAction(mode: "replace" | "remove" | "edit") {
  if (actionMode.value === mode) return;
  if (dirty.value && actionMode.value !== mode && !window.confirm("Discard the unsaved Review update before choosing another action?")) return;
  actionMode.value = mode;
  newContextDraft.value = "";
  replacementContext.value = "";
  if (mode !== "edit") {
    editStepId.value = "";
    stepDraft.value = "";
    stepVersion.value = 0;
  }
  if (mode === "edit") {
    const step = targetStep.value ?? props.procedure.steps[0];
    editStepId.value = step?.step ?? "";
    stepDraft.value = step?.text ?? "";
    stepVersion.value = step?.version ?? 0;
  }
}
function resetAction() {
  actionMode.value = "";
  replacementMode.value = "existing";
  replacementContext.value = "";
  newContextDraft.value = "";
  editStepId.value = "";
  stepDraft.value = "";
  stepVersion.value = 0;
}
function preserveTargetAfterConnectionChange() {
  selectedAttachment.value = "";
  resetAction();
}
function replaceContext() {
  const current = selectedConnection.value;
  if (!current) return;
  const replacementNote = replacementMode.value === "existing"
    ? props.contexts.find(({ context }) => context === replacementContext.value)
    : undefined;
  const text = replacementMode.value === "new" ? newContextDraft.value.trim() : undefined;
  if ((!replacementNote && !text) || (replacementNote && text)) return;
  emit("replaceContext", { currentNote: current.note, attachment: current.attachment, replacementNote, text, onSuccess: preserveTargetAfterConnectionChange });
}
function removeContext() {
  const current = selectedConnection.value;
  if (!current) return;
  emit("detachContext", { ...current, onSuccess: preserveTargetAfterConnectionChange, skipConfirmation: true });
}
function editStep() {
  const step = editTargetStep.value;
  const text = stepDraft.value.trim();
  if (!step || !text) return;
  emit("editStep", { procedure: props.procedure, step, text, expectedVersion: stepVersion.value || step.version, onSuccess: resetAction });
}
function saveMyStep() {
  if (!editTargetStep.value) return;
  stepVersion.value = editTargetStep.value.version;
  editStep();
}
function chooseEditStep(select: HTMLSelectElement) {
  const stepId = select.value;
  if (dirty.value && !window.confirm("Discard the unsaved Step edit and open another Step?")) { select.value = editStepId.value; return; }
  const step = props.procedure.steps.find(({ step }) => step === stepId);
  if (!step) return;
  editStepId.value = step.step;
  stepDraft.value = step.text;
  stepVersion.value = step.version;
}
</script>

<template>
  <section class="review-repair" aria-label="Update this Review">
    <header class="review-repair-heading">
      <div><span>Update this Review</span><h3>Choose one connection, then one change</h3><p>Your saved changes appear below before you resolve the Review.</p></div>
      <button class="button button-small button-secondary" type="button" :disabled="!!actionBusy || !canEdit" @click="emit('editPlaybook', review)">Open full Playbook editor</button>
    </header>

    <div v-if="connections.length" class="review-connection-picker" role="group" aria-label="Changed Context connections">
      <button v-for="connection in connections" :key="connection.attachment.attachment" type="button" :class="{ selected: connection.attachment.attachment === selectedConnection?.attachment.attachment }" :aria-pressed="connection.attachment.attachment === selectedConnection?.attachment.attachment" @click="chooseConnection(connection.attachment)">
        <span>{{ targetLabel(connection.attachment.anchor) }}</span><strong>{{ connection.note.text }}</strong>
      </button>
    </div>
    <p v-else class="review-connection-resolved">The changed Context is no longer attached to this Playbook. Review the current state below, then resolve when it is correct.</p>

    <div v-if="selectedAnchor !== undefined" class="review-target-state">
      <div><span>Current target</span><strong>{{ targetLabel(selectedAnchor) }}</strong><p v-if="targetStep">{{ targetStep.text }}</p></div>
      <div><span>Context attached now</span><ul v-if="contextsAtTarget.length"><li v-for="note in contextsAtTarget" :key="note.context">{{ note.text }}</li></ul><p v-else>No Context Note is attached to this target.</p></div>
    </div>

    <template v-if="selectedConnection">
      <nav class="review-update-choices" aria-label="Update options">
        <button v-if="canEditContext" type="button" :class="{ selected: actionMode === 'replace' }" @click="chooseAction('replace')"><strong>Replace Context</strong><small>Use an existing Note or write a new one</small></button>
        <button v-if="canEditContext" type="button" :class="{ selected: actionMode === 'remove' }" @click="chooseAction('remove')"><strong>Remove Context</strong><small>Detach it; keep the shared Note</small></button>
        <button v-if="canEdit && procedure.steps.length" type="button" :class="{ selected: actionMode === 'edit' }" @click="chooseAction('edit')"><strong>Edit a Step</strong><small>Change an instruction directly</small></button>
      </nav>

      <form v-if="actionMode === 'replace'" class="review-update-form" @submit.prevent="replaceContext">
        <div class="context-mode" role="group" aria-label="Replacement source"><button type="button" :class="{ active: replacementMode === 'existing' }" @click="replacementMode = 'existing'">Use existing</button><button type="button" :class="{ active: replacementMode === 'new' }" @click="replacementMode = 'new'">Write new</button></div>
        <template v-if="replacementMode === 'existing'"><label :for="`review-existing-context-${review.review}`">Replacement shared Context</label><select :id="`review-existing-context-${review.review}`" v-model="replacementContext" required><option value="" disabled>Choose a Context Note…</option><option v-for="note in availableExistingContexts" :key="note.context" :value="note.context">{{ note.text }}</option></select><p v-if="!availableExistingContexts.length" class="form-guidance">No other Context Notes are available for this target. Write a new one instead.</p></template>
        <template v-else><label :for="`review-new-context-${review.review}`">New shared Context</label><textarea :id="`review-new-context-${review.review}`" v-model="newContextDraft" placeholder="Record the replacement decision, constraint, or reason…" required maxlength="4000" rows="3"></textarea></template>
        <p class="form-guidance">Relay attaches the replacement first, then removes the changed Context from {{ targetLabel(selectedAnchor ?? null) }}.</p>
        <div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || (replacementMode === 'existing' ? !replacementContext : !newContextDraft.trim())">{{ actionBusy.startsWith('replace-context-') ? "Replacing…" : "Replace Context" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="resetAction">Cancel</button></div>
      </form>

      <div v-else-if="actionMode === 'remove'" class="review-update-form review-remove-confirmation"><strong>Remove this Context from {{ targetLabel(selectedAnchor ?? null) }}?</strong><p>The shared Context Note and its change history will remain available. Only this connection is removed.</p><div class="form-actions"><button class="button button-secondary danger-text" type="button" :disabled="!!actionBusy" @click="removeContext">{{ actionBusy === `detach-${selectedConnection.attachment.attachment}` ? "Removing…" : "Remove Context" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="resetAction">Cancel</button></div></div>

      <form v-else-if="actionMode === 'edit' && editTargetStep" class="review-update-form" @submit.prevent="editStep"><label :for="`review-step-choice-${review.review}`">Step to edit</label><select :id="`review-step-choice-${review.review}`" :value="editStepId" @change="chooseEditStep($event.target as HTMLSelectElement)"><option v-for="step in procedure.steps" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option></select><label :for="`review-edit-${editTargetStep.step}`">Step {{ editTargetStep.position }} instruction</label><textarea :id="`review-edit-${editTargetStep.step}`" v-model="stepDraft" required maxlength="500" rows="3"></textarea><div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !stepDraft.trim()">{{ actionBusy === `edit-${editTargetStep.step}` ? "Saving…" : "Save Step" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="resetAction">Cancel</button></div><VersionConflict v-if="stepVersion !== editTargetStep.version" subject="step" saved-label="Current saved instruction" :saved-value="editTargetStep.text" draft-label="Your unsaved instruction" :draft-value="stepDraft" :busy="!!actionBusy" @use-saved="resetAction" @save-mine="saveMyStep" /></form>
    </template>
  </section>
</template>
