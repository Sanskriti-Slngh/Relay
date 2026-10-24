<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { Attachment, ContextNote, PendingReview, Procedure, Step } from "../api.ts";
import { contextConnectionsForReview, stepForReviewRepair } from "../review-context.ts";
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
const actionMode = ref<"replace" | "remove" | "">("");
const replacementMode = ref<"existing" | "new">("existing");
const replacementContext = ref("");
const newContextDraft = ref("");
const editStepId = ref("");
const stepDraft = ref("");
const stepVersion = ref(0);
const stepSaved = ref(false);

const connections = computed(() => contextConnectionsForReview(
  props.review.causes.map(({ cause }) => cause),
  props.review.procedure,
  props.contexts,
));
const selectedConnection = computed(() => connections.value.find(({ attachment }) => attachment.attachment === selectedAttachment.value));
const editTargetStep = computed(() => props.procedure.steps.find(({ step }) => step === editStepId.value));
const availableExistingContexts = computed(() => props.contexts.filter((note) =>
  note.context !== selectedConnection.value?.note.context &&
  !note.attachments.some((attachment) => attachment.subject === props.procedure.procedure && attachment.anchor === (selectedAnchor.value ?? null)),
));
const dirty = computed(() =>
  (actionMode.value === "replace" && !!newContextDraft.value.trim()) ||
  (!stepSaved.value && !!editTargetStep.value && hasChangedDraft(editTargetStep.value.text, [stepDraft.value])),
);

watch(connections, (next) => {
  if (next.some(({ attachment }) => attachment.attachment === selectedAttachment.value)) return;
  if (!selectedAttachment.value && selectedAnchor.value !== undefined) return;
  const first = next[0];
  selectedAttachment.value = first?.attachment.attachment ?? "";
  selectedAnchor.value = first?.attachment.anchor;
  prepareStepEditor(first?.attachment.anchor);
}, { immediate: true });
watch(() => props.procedure.steps, () => {
  if (!stepSaved.value) return;
  const step = props.procedure.steps.find(({ step }) => step === editStepId.value);
  if (!step) return;
  stepDraft.value = step.text;
  stepVersion.value = step.version;
}, { deep: true });
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
  resetAlternative();
  prepareStepEditor(attachment.anchor);
}
function chooseAction(mode: "replace" | "remove") {
  if (actionMode.value === mode) return;
  if (dirty.value && actionMode.value !== mode && !window.confirm("Discard the unsaved Review update before choosing another action?")) return;
  prepareStepEditor(selectedAnchor.value);
  actionMode.value = mode;
  newContextDraft.value = "";
  replacementContext.value = "";
}
function resetAlternative() {
  actionMode.value = "";
  replacementMode.value = "existing";
  replacementContext.value = "";
  newContextDraft.value = "";
}
function prepareStepEditor(anchor: string | null | undefined) {
  const step = stepForReviewRepair(anchor, props.procedure.steps, editStepId.value);
  editStepId.value = step?.step ?? "";
  stepDraft.value = step?.text ?? "";
  stepVersion.value = step?.version ?? 0;
  stepSaved.value = false;
}
function preserveTargetAfterConnectionChange() {
  selectedAttachment.value = "";
  selectedAnchor.value = undefined;
  resetAlternative();
  prepareStepEditor(undefined);
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
  emit("editStep", { procedure: props.procedure, step, text, expectedVersion: stepVersion.value || step.version, onSuccess: () => { stepDraft.value = text; stepVersion.value = step.version; stepSaved.value = true; } });
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
  stepSaved.value = false;
}
</script>

<template>
  <section class="review-repair" aria-label="Update this Review">
    <header class="review-repair-heading">
      <h3>{{ editTargetStep ? `Update Step ${editTargetStep.position}` : "Update affected instructions" }}</h3>
      <button class="review-editor-link" type="button" :disabled="!!actionBusy || !canEdit" @click="emit('editPlaybook', review)">Open full Playbook editor</button>
    </header>

    <div v-if="connections.length > 1" class="review-connection-picker" role="group" aria-label="Changed Context connections">
      <p>Choose the Context connection to update.</p>
      <button v-for="connection in connections" :key="connection.attachment.attachment" type="button" :class="{ selected: connection.attachment.attachment === selectedConnection?.attachment.attachment }" :aria-pressed="connection.attachment.attachment === selectedConnection?.attachment.attachment" @click="chooseConnection(connection.attachment)">
        <span>{{ targetLabel(connection.attachment.anchor) }}</span><strong>{{ connection.note.text }}</strong>
      </button>
    </div>
    <p v-else-if="!connections.length" class="review-connection-resolved">The changed Context is no longer attached to this Playbook. Review the current state below, then resolve when it is correct.</p>

    <form v-if="selectedConnection && canEdit && editTargetStep" class="review-inline-step-editor" @submit.prevent="editStep">
      <label v-if="selectedAnchor === null" :for="`review-step-choice-${review.review}`">Step to edit</label>
      <select v-if="selectedAnchor === null" :id="`review-step-choice-${review.review}`" :value="editStepId" @change="chooseEditStep($event.target as HTMLSelectElement)"><option v-for="step in procedure.steps" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option></select>
      <label class="sr-only" :for="`review-edit-${editTargetStep.step}`">Step {{ editTargetStep.position }} instruction</label>
      <textarea :id="`review-edit-${editTargetStep.step}`" v-model="stepDraft" required maxlength="500" rows="3" @input="stepSaved = false"></textarea>
      <div class="review-step-save-row"><button class="button button-primary" type="submit" :disabled="!!actionBusy || !stepDraft.trim() || !hasChangedDraft(editTargetStep.text, [stepDraft])">{{ actionBusy === `edit-${editTargetStep.step}` ? "Saving…" : "Save Step" }}</button><p v-if="stepSaved" role="status"><strong>Step saved.</strong> The Review remains open until resolved.</p></div>
      <VersionConflict v-if="!stepSaved && stepVersion !== editTargetStep.version" subject="step" saved-label="Current saved instruction" :saved-value="editTargetStep.text" draft-label="Your unsaved instruction" :draft-value="stepDraft" :busy="!!actionBusy" @use-saved="prepareStepEditor(selectedAnchor)" @save-mine="saveMyStep" />
    </form>

    <details v-if="selectedConnection && canEditContext" class="review-alternative-actions">
      <summary>Other fixes</summary>
      <nav class="review-update-choices" aria-label="Other update options">
        <button type="button" :class="{ selected: actionMode === 'replace' }" @click="chooseAction('replace')"><strong>Replace Context</strong><small>Use an existing Note or write a new one</small></button>
        <button type="button" :class="{ selected: actionMode === 'remove' }" @click="chooseAction('remove')"><strong>Remove attachment</strong><small>Keep the shared Note, but detach it here</small></button>
      </nav>

      <form v-if="actionMode === 'replace'" class="review-update-form" @submit.prevent="replaceContext">
        <p class="review-alternative-target"><strong>Replacing on {{ targetLabel(selectedAnchor ?? null) }}</strong><span>{{ selectedConnection.note.text }}</span></p>
        <div class="context-mode" role="group" aria-label="Replacement source"><button type="button" :class="{ active: replacementMode === 'existing' }" @click="replacementMode = 'existing'">Use existing</button><button type="button" :class="{ active: replacementMode === 'new' }" @click="replacementMode = 'new'">Write new</button></div>
        <template v-if="replacementMode === 'existing'"><label :for="`review-existing-context-${review.review}`">Replacement shared Context</label><select :id="`review-existing-context-${review.review}`" v-model="replacementContext" required><option value="" disabled>Choose a Context Note…</option><option v-for="note in availableExistingContexts" :key="note.context" :value="note.context">{{ note.text }}</option></select><p v-if="!availableExistingContexts.length" class="form-guidance">No other Context Notes are available for this target. Write a new one instead.</p></template>
        <template v-else><label :for="`review-new-context-${review.review}`">New shared Context</label><textarea :id="`review-new-context-${review.review}`" v-model="newContextDraft" placeholder="Record the replacement decision, constraint, or reason…" required maxlength="4000" rows="3"></textarea></template>
        <p class="form-guidance">Relay attaches the replacement first, then removes the changed Context from {{ targetLabel(selectedAnchor ?? null) }}.</p>
        <div class="form-actions"><button class="button button-primary" type="submit" :disabled="!!actionBusy || (replacementMode === 'existing' ? !replacementContext : !newContextDraft.trim())">{{ actionBusy.startsWith('replace-context-') ? "Replacing…" : "Replace Context" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="resetAlternative">Cancel</button></div>
      </form>

      <div v-else-if="actionMode === 'remove'" class="review-update-form review-remove-confirmation"><strong>Remove this Context from {{ targetLabel(selectedAnchor ?? null) }}?</strong><p>The shared Context Note and its change history will remain available. Only this connection is removed.</p><div class="form-actions"><button class="button button-secondary danger-text" type="button" :disabled="!!actionBusy" @click="removeContext">{{ actionBusy === `detach-${selectedConnection.attachment.attachment}` ? "Removing…" : "Remove attachment" }}</button><button class="button button-quiet" type="button" :disabled="!!actionBusy" @click="resetAlternative">Cancel</button></div></div>
    </details>
  </section>
</template>
