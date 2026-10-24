<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { createRelayApi, RelayApiError, type ActivityEvent, type ContextNote, type ContextQuestion, type IssuedInvitation, type PendingInvitation, type PendingReview, type Procedure, type ProcedureReviewHistory, type SessionState, type StepQuestion, type WorkspaceMember, type WorkspaceMembership } from "./api.ts";
import ContextView from "./components/ContextView.vue";
import OverviewView from "./components/OverviewView.vue";
import PlaybooksView from "./components/PlaybooksView.vue";
import ReviewsView from "./components/ReviewsView.vue";
import QuestionsView from "./components/QuestionsView.vue";
import WorkspaceView from "./components/WorkspaceView.vue";
import { confirmedAffectedPlaybooks, type ContextChangeResult } from "./context-change-result.ts";
import { recordAndAttachInlineContext } from "./inline-context.ts";
import { refreshAfterVersionConflict } from "./version-conflict-recovery.ts";
import { discardAfterSuccessfulAction, shouldConfirmDiscard } from "./unsaved-work.ts";

type Section = "overview" | "procedures" | "context" | "reviews" | "questions" | "workspace";

const api = createRelayApi();
const section = ref<Section>("overview");
const focusedProcedure = ref("");
const focusedContextStep = ref("");
const focusedReviewId = ref("");
const focusedQuestionId = ref("");
const focusedQuestionKind = ref<"step" | "context" | "">("");
const startNewPlaybook = ref(false);
const authenticated = ref(false);
const sessionChecked = ref(false);
const workspace = ref("");
const workspaceName = ref("");
const currentUser = ref<{ id: string; email: string; name: string }>();
const role = ref("");
const permissions = ref<string[]>([]);
const workspaces = ref<WorkspaceMembership[]>([]);
const csrfToken = ref("");
const authMode = ref<"signin" | "register">("signin");
const email = ref("");
const password = ref("");
const displayName = ref("");
const clubName = ref("");
const invitationToken = ref("");
const createdInvite = ref<IssuedInvitation>();
const loginBusy = ref(false);
const refreshing = ref(false);
const actionBusy = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const procedures = ref<Procedure[]>([]);
const contexts = ref<ContextNote[]>([]);
const reviews = ref<PendingReview[]>([]);
const reviewHistory = ref<ProcedureReviewHistory[]>([]);
const stepQuestions = ref<StepQuestion[]>([]);
const contextQuestions = ref<ContextQuestion[]>([]);
const workspaceMembers = ref<WorkspaceMember[]>([]);
const pendingInvitations = ref<PendingInvitation[]>([]);
const recentActivity = ref<ActivityEvent[]>([]);
const contextChangeResult = ref<ContextChangeResult>();
const hasUnsavedWork = ref(false);
const playbooksEditorKey = ref(0);
let refreshSequence = 0;
let refreshTimer: number | undefined;

const unfinishedCount = computed(() => reviews.value.length);
const unansweredCount = computed(() =>
  stepQuestions.value.filter(({ status }) => status === "OPEN").length +
  contextQuestions.value.filter(({ status }) => status === "OPEN").length,
);
const canEdit = computed(() => permissions.value.includes("EDIT_PROCEDURE"));
const canEditContext = computed(() => permissions.value.includes("EDIT_CONTEXT"));
const canReview = computed(() => permissions.value.includes("COMPLETE_REVIEW"));
const canAnswer = computed(() => permissions.value.includes("ANSWER_QUESTION"));
const hasWorkspace = computed(() => !!workspace.value);
const ownershipConfigured = computed(() => workspaces.value.find(({ workspace: id }) => id === workspace.value)?.ownershipConfigured ?? false);
const focusedReview = computed(() => reviews.value.find(({ review }) => review === focusedReviewId.value));
const navigation: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "procedures", label: "Playbooks" },
  { id: "context", label: "Shared context" },
  { id: "reviews", label: "Reviews" },
  { id: "questions", label: "Questions" },
  { id: "workspace", label: "Workspace" },
];

function clearMessages() { errorMessage.value = ""; successMessage.value = ""; }

function confirmDiscardUnsavedWork(): boolean {
  return !shouldConfirmDiscard(hasUnsavedWork.value, true) || window.confirm("Discard your unsaved work? Relay has not saved the text in the open form.");
}

function navigate(target: { section: Section; procedure?: string; review?: string; question?: string; questionKind?: "step" | "context"; createPlaybook?: boolean }) {
  if (target.section !== section.value && !confirmDiscardUnsavedWork()) return;
  clearMessages();
  focusedProcedure.value = target.procedure ?? "";
  focusedContextStep.value = "";
  focusedReviewId.value = target.review ?? "";
  focusedQuestionId.value = target.question ?? "";
  focusedQuestionKind.value = target.questionKind ?? "";
  startNewPlaybook.value = target.createPlaybook ?? false;
  hasUnsavedWork.value = false;
  section.value = target.section;
}

function clearWorkspaceUiState() {
  hasUnsavedWork.value = false;
  focusedProcedure.value = "";
  focusedContextStep.value = "";
  focusedReviewId.value = "";
  focusedQuestionId.value = "";
  focusedQuestionKind.value = "";
  startNewPlaybook.value = false;
  createdInvite.value = undefined;
  procedures.value = [];
  contexts.value = [];
  reviews.value = [];
  reviewHistory.value = [];
  stepQuestions.value = [];
  contextQuestions.value = [];
  workspaceMembers.value = [];
  pendingInvitations.value = [];
  recentActivity.value = [];
  contextChangeResult.value = undefined;
  section.value = "overview";
}

function clearWorkspaceState() {
  refreshSequence += 1;
  clearWorkspaceUiState();
  authenticated.value = false;
  csrfToken.value = "";
  workspace.value = "";
  workspaceName.value = "";
  currentUser.value = undefined;
  role.value = "";
  permissions.value = [];
  workspaces.value = [];
}

function showError(error: unknown) {
  if (error instanceof RelayApiError && (error.status === 401 || error.code === "CSRF_REJECTED")) clearWorkspaceState();
  errorMessage.value = error instanceof Error ? error.message : "Something went wrong. Try again.";
  successMessage.value = "";
}

function showValidationError(message: string) { clearMessages(); errorMessage.value = message; }

async function refreshData(announce = false, background = false): Promise<boolean> {
  if (!csrfToken.value || !workspace.value) return false;
  if (background && (refreshing.value || !!actionBusy.value || document.hidden)) return false;
  const sequence = ++refreshSequence;
  if (!background) {
    refreshing.value = true;
    clearMessages();
  }
  try {
    const latestSession = await api.session();
    if (sequence !== refreshSequence) return false;
    if (!latestSession.authenticated) {
      clearWorkspaceState();
      return false;
    }
    csrfToken.value = latestSession.csrfToken ?? csrfToken.value;
    currentUser.value = latestSession.user;
    workspaces.value = latestSession.workspaces ?? [];
    role.value = latestSession.role ?? "";
    permissions.value = latestSession.permissions ?? [];
    workspaceName.value = latestSession.workspaceName ?? "";
    if (latestSession.workspace !== workspace.value) {
      clearWorkspaceUiState();
      workspace.value = latestSession.workspace ?? "";
      return true;
    }
    const officerReads = canReview.value
      ? Promise.all([api.pendingReviews(csrfToken.value), api.reviewHistory(csrfToken.value)])
      : Promise.resolve([{ reviews: [] as PendingReview[] }, { procedures: [] as ProcedureReviewHistory[] }] as const);
    const invitationRead = canEdit.value
      ? api.pendingInvitations(csrfToken.value)
      : Promise.resolve({ invitations: [] as PendingInvitation[] });
    const activityRead = canEdit.value
      ? api.recentActivity(csrfToken.value)
      : Promise.resolve({ events: [] as ActivityEvent[] });
    const [procedureResult, contextResult, [reviewResult, historyResult], questionResult, memberResult, invitationResult, activityResult] = await Promise.all([
      api.procedures(csrfToken.value), api.contextHistory(csrfToken.value),
      officerReads, api.questions(csrfToken.value), api.workspaceMembers(csrfToken.value), invitationRead, activityRead,
    ]);
    if (sequence !== refreshSequence) return false;
    procedures.value = procedureResult.procedures;
    contexts.value = contextResult.contexts;
    reviews.value = reviewResult.reviews;
    reviewHistory.value = historyResult.procedures;
    stepQuestions.value = questionResult.stepQuestions;
    contextQuestions.value = questionResult.contextQuestions;
    workspaceMembers.value = memberResult.members;
    pendingInvitations.value = invitationResult.invitations;
    recentActivity.value = activityResult.events;
    if (announce) successMessage.value = "Workspace information is up to date.";
    return true;
  } catch (error) {
    if (
      sequence === refreshSequence &&
      (!background || (error instanceof RelayApiError && (error.status === 401 || error.code === "CSRF_REJECTED")))
    ) showError(error);
    return false;
  } finally {
    if (!background && sequence === refreshSequence) refreshing.value = false;
  }
}

async function runAction(label: string, action: () => Promise<void>, success: string) {
  if (actionBusy.value) {
    showValidationError("Please wait for the current workspace action to finish.");
    return;
  }
  clearMessages();
  actionBusy.value = label;
  try {
    await action();
    const refreshed = await refreshData();
    successMessage.value = refreshed ? success : "The action completed, but the workspace could not refresh. Try Refresh.";
  } catch (error) {
    showError(error);
    await refreshAfterVersionConflict(error, () => { actionBusy.value = ""; }, () => refreshData(false, true));
  }
  finally { actionBusy.value = ""; }
}

async function acceptSession(session: SessionState) {
  refreshSequence += 1;
  clearWorkspaceUiState();
  authenticated.value = session.authenticated;
  csrfToken.value = session.csrfToken ?? "";
  workspace.value = session.workspace ?? "";
  workspaceName.value = session.workspaceName ?? "";
  currentUser.value = session.user;
  role.value = session.role ?? "";
  permissions.value = session.permissions ?? [];
  workspaces.value = session.workspaces ?? [];
  if (authenticated.value && workspace.value) await refreshData();
}

async function signIn() {
  clearMessages(); loginBusy.value = true;
  try {
    const session = authMode.value === "register"
      ? await api.register(email.value, password.value, displayName.value)
      : await api.signIn(email.value, password.value);
    password.value = "";
    await acceptSession(session);
  } catch (error) { password.value = ""; showError(error); }
  finally { loginBusy.value = false; }
}

async function createClub(payload?: { name: string; onSuccess: () => void }) {
  const name = (payload?.name ?? clubName.value).trim(); if (!name) return;
  await runAction("create-workspace", async () => {
    await acceptSession(await api.createWorkspace(name, csrfToken.value));
    if (payload) payload.onSuccess(); else clubName.value = "";
  }, "Club workspace created. You are its Owner.");
}

async function selectClub(id: string, select?: HTMLSelectElement) {
  if (!confirmDiscardUnsavedWork()) {
    if (select) select.value = workspace.value;
    return;
  }
  await runAction("select-workspace", async () => { await acceptSession(await api.selectWorkspace(id, csrfToken.value)); }, "Workspace selected.");
}

async function acceptInvitation(payload?: { token: string; onSuccess: () => void }) {
  const token = (payload?.token ?? invitationToken.value).trim(); if (!token) return;
  await runAction("accept-invitation", async () => {
    await acceptSession(await api.acceptInvitation(token, csrfToken.value));
    if (payload) payload.onSuccess(); else invitationToken.value = "";
  }, "Invitation accepted. You joined as a Member.");
}

async function inviteMember({ email: address, onSuccess }: { email: string; onSuccess: () => void }) {
  await runAction("invite-member", async () => {
    const invite = await api.createInvitation(address, csrfToken.value);
    createdInvite.value = invite; onSuccess();
  }, "Invitation code created. Relay does not send email; share the code securely with the invited member.");
}

async function reissueInvitation(invitation: PendingInvitation) {
  await runAction(`reissue-invitation-${invitation.invitation}`, async () => {
    const replacement = await api.reissueInvitation(invitation.invitation, csrfToken.value);
    createdInvite.value = { ...replacement, reissued: true };
  }, "A replacement invitation code was created. The previous code no longer works.");
}

async function claimOwnership() {
  if (!window.confirm("Claim ownership of this legacy workspace? You will become its only Owner.")) return;
  await runAction("claim-ownership", async () => { await acceptSession(await api.claimOwnership(csrfToken.value)); }, "You are now the workspace Owner.");
}

async function changeMemberRole({ member, role: nextRole }: { member: WorkspaceMember; role: "Officer" | "Member" }) {
  if (!window.confirm(`${nextRole === "Officer" ? "Promote" : "Demote"} ${member.name} to ${nextRole}?`)) return;
  await runAction(`role-${member.user}`, async () => { await api.changeMemberRole(member.user, nextRole, csrfToken.value); }, `${member.name} is now ${nextRole}.`);
}

async function removeWorkspaceMember(member: WorkspaceMember) {
  if (!window.confirm(`Remove ${member.name} from ${workspaceName.value}? Their access will end immediately.`)) return;
  await runAction(`remove-member-${member.user}`, async () => { await api.removeMember(member.user, csrfToken.value); }, `${member.name} was removed from the workspace.`);
}

async function transferOwnership({ member, formerOwnerRole, onSuccess }: { member: WorkspaceMember; formerOwnerRole: "Officer" | "Member"; onSuccess: () => void }) {
  if (!window.confirm(`Transfer ownership to ${member.name}? You will become ${formerOwnerRole}.`)) return;
  await runAction("transfer-ownership", async () => {
    await acceptSession(await api.transferOwnership(member.user, formerOwnerRole, csrfToken.value));
    onSuccess();
  }, `Ownership transferred to ${member.name}.`);
}

async function signOut() {
  if (!confirmDiscardUnsavedWork()) return;
  clearMessages();
  try { await api.logout(csrfToken.value); }
  catch (error) { showError(error); return; }
  clearWorkspaceState();
}

async function createProcedure({ title, onSuccess }: { title: string; onSuccess: () => void }) {
  await runAction("create-procedure", async () => {
    const created = await api.createProcedure(title, csrfToken.value);
    focusedProcedure.value = created.procedure;
    onSuccess();
    section.value = "procedures";
  }, "Playbook created.");
}

async function addStep({ procedure, text, expectedVersion, onSuccess }: { procedure: Procedure; text: string; expectedVersion: number; onSuccess: () => void }) {
  await runAction(`step-${procedure.procedure}`, async () => {
    await api.addStep(procedure.procedure, text, expectedVersion, csrfToken.value);
    onSuccess();
  }, "Step added.");
}

async function renameProcedure({ procedure, title, expectedVersion, onSuccess }: { procedure: Procedure; title: string; expectedVersion: number; onSuccess: () => void }) {
  await runAction(`rename-${procedure.procedure}`, async () => { await api.renameProcedure(procedure.procedure, title, expectedVersion, csrfToken.value); onSuccess(); }, "Playbook renamed.");
}

async function editStep({ procedure, step, text, expectedVersion, onSuccess }: { procedure: Procedure; step: Procedure["steps"][number]; text: string; expectedVersion: number; onSuccess: () => void }) {
  await runAction(`edit-${step.step}`, async () => { await api.editStep(procedure.procedure, step.step, text, expectedVersion, csrfToken.value); onSuccess(); }, "Step updated.");
}

async function moveStep({ procedure, step, position }: { procedure: Procedure; step: Procedure["steps"][number]; position: number }) {
  await runAction(`move-${step.step}`, async () => { await api.moveStep(procedure.procedure, step.step, position, procedure.version, csrfToken.value); }, "");
}

async function removeStep({ procedure, step }: { procedure: Procedure; step: Procedure["steps"][number] }) {
  if (!window.confirm(`Remove step ${step.position} from "${procedure.title}"? Any context attached specifically to this step will be detached.`)) return;
  await runAction(`remove-${step.step}`, async () => { await api.removeStep(procedure.procedure, step.step, procedure.version, csrfToken.value); }, "Step removed. Its stable identity and history are preserved.");
}

async function archiveProcedure(procedure: Procedure) {
  const draftWarning = hasUnsavedWork.value ? " Unsaved text in this Playbook will be discarded." : "";
  if (!window.confirm(`Archive "${procedure.title}"? It will leave the active Playbooks list. Its Steps, Context attachments, and Review history will be preserved.${draftWarning}`)) return;
  await runAction(`archive-${procedure.procedure}`, async () => {
    await discardAfterSuccessfulAction(
      () => api.archiveProcedure(procedure.procedure, procedure.version, csrfToken.value),
      () => { playbooksEditorKey.value += 1; },
    );
  }, "Playbook archived. Its context and review history are preserved.");
}

async function recordContext({ text, onSuccess }: { text: string; onSuccess: () => void }) {
  await runAction("record-context", async () => { await api.recordContextNote(text, csrfToken.value); onSuccess(); section.value = "context"; }, "Shared context note recorded.");
}

async function attachContext({ note, procedure, step, onSuccess }: { note: ContextNote; procedure: string; step: string; onSuccess: () => void }) {
  await runAction(`attach-${note.context}`, async () => {
    if (step) await api.attachContextNoteAtStep(note.context, procedure, step, csrfToken.value);
    else await api.attachContextNote(note.context, procedure, csrfToken.value);
    onSuccess();
  }, "Context note attached.");
}

async function attachStepContext({ note, procedure, step, onSuccess }: { note: ContextNote; procedure: Procedure; step: Procedure["steps"][number]; onSuccess: () => void }) {
  await runAction(`attach-step-${step.step}`, async () => {
    await api.attachContextNoteAtStep(note.context, procedure.procedure, step.step, csrfToken.value);
    onSuccess();
  }, "Context attached to the step.");
}

async function recordStepContext({ procedure, step, text, onSuccess, onRecordedOnly }: { procedure: Procedure; step: Procedure["steps"][number]; text: string; onSuccess: () => void; onRecordedOnly: (context: string) => void }) {
  if (actionBusy.value) {
    showValidationError("Please wait for the current workspace action to finish.");
    return;
  }
  clearMessages();
  actionBusy.value = `record-step-context-${step.step}`;
  try {
    const result = await recordAndAttachInlineContext(
      () => api.recordContextNote(text, csrfToken.value),
      (context) => api.attachContextNoteAtStep(context, procedure.procedure, step.step, csrfToken.value),
    );
    if (result.status === "ATTACHED") {
      onSuccess();
      const refreshed = await refreshData();
      successMessage.value = refreshed
        ? "Context saved with the step."
        : "The context was saved with the step, but the workspace could not refresh. Try Refresh.";
      return;
    }

    actionBusy.value = "";
    const refreshed = await refreshData(false, true);
    onRecordedOnly(result.context);
    if (result.cause instanceof RelayApiError && (result.cause.status === 401 || result.cause.code === "CSRF_REJECTED")) {
      clearWorkspaceState();
      errorMessage.value = "The note was saved, but your session ended before it could be attached. Sign in again, then attach the saved note under Use existing.";
    } else {
      errorMessage.value = refreshed
        ? "The note was saved, but it could not be attached. It is selected under Use existing so you can retry without creating another note."
        : "The note was saved, but it could not be attached or shown after refresh. Try Refresh, then attach the saved note under Use existing.";
    }
  } catch (error) {
    showError(error);
  } finally {
    actionBusy.value = "";
  }
}

async function correctContext({ note, text, expectedVersion, onSuccess }: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }) {
  contextChangeResult.value = undefined;
  await runAction(`correct-${note.context}`, async () => { await api.correctContextNote(note.context, text, expectedVersion, csrfToken.value); onSuccess(); }, "Wording corrected. No review was created.");
}

async function changeContext({ note, text, expectedVersion, onSuccess }: { note: ContextNote; text: string; expectedVersion: number; onSuccess: () => void }) {
  if (actionBusy.value) {
    showValidationError("Please wait for the current workspace action to finish.");
    return;
  }
  clearMessages();
  contextChangeResult.value = undefined;
  actionBusy.value = `change-${note.context}`;
  try {
    const changed = await api.changeContextNote(note.context, text, expectedVersion, csrfToken.value);
    const refreshed = await refreshData();
    onSuccess();
    if (refreshed) {
      contextChangeResult.value = {
        context: note.context,
        affectedPlaybooks: confirmedAffectedPlaybooks(changed.change, reviews.value),
      };
    } else {
      successMessage.value = "The information changed, but Relay could not confirm the affected reviews. Try Refresh.";
    }
  } catch (error) {
    showError(error);
    await refreshAfterVersionConflict(error, () => { actionBusy.value = ""; }, () => refreshData(false, true));
  } finally {
    actionBusy.value = "";
  }
}

function reviewAffectedPlaybooks(review: string) {
  navigate({ section: "reviews", review });
}

async function confirmReview(review: PendingReview) {
  await runAction(`confirm-${review.review}`, async () => { await api.confirmReview(review.review, review.procedure, review.version, csrfToken.value); }, "Review confirmed as correct.");
}

async function requireReviewChanges(review: PendingReview) {
  await runAction(`require-${review.review}`, async () => { await api.requireReviewChanges(review.review, review.procedure, review.version, csrfToken.value); }, "Review marked as requiring changes. Edit the playbook, then resolve the review.");
}

async function resolveReview(review: PendingReview) {
  await runAction(`resolve-${review.review}`, async () => { await api.resolveReview(review.review, review.procedure, review.version, csrfToken.value); }, "Review resolved. Its causes remain in review history.");
}

async function cancelReview(review: PendingReview) {
  if (!window.confirm(`Cancel the review for "${review.title}"? Its causes will remain in review history.`)) return;
  await runAction(`cancel-${review.review}`, async () => { await api.cancelReview(review.review, review.procedure, review.version, csrfToken.value); }, "Review cancelled. Its causes remain in review history.");
}

function editReviewedPlaybook(review: PendingReview) {
  clearMessages();
  focusedProcedure.value = review.procedure;
  focusedReviewId.value = review.review;
  section.value = "procedures";
}

function returnToReview() {
  if (!confirmDiscardUnsavedWork()) return;
  clearMessages();
  focusedProcedure.value = "";
  hasUnsavedWork.value = false;
  section.value = "reviews";
}

async function askStepQuestion({ procedure, step, text, onSuccess }: { procedure: Procedure; step: Procedure["steps"][number]; text: string; onSuccess: () => void }) {
  await runAction(`ask-step-${step.step}`, async () => {
    await api.askStepQuestion(procedure.procedure, step.step, text, csrfToken.value);
    onSuccess();
  }, "Question sent to the officer inbox.");
}

async function askContextQuestion({ note, procedure, text, onSuccess }: { note: ContextNote; procedure: string; text: string; onSuccess: () => void }) {
  await runAction(`ask-context-${note.context}`, async () => {
    await api.askContextQuestion(procedure, note.context, text, csrfToken.value);
    onSuccess();
  }, "Question sent to the officer inbox.");
}

async function answerQuestion({ kind, question, answer, expectedVersion, onSuccess }: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; answer: string; expectedVersion: number; onSuccess: () => void }) {
  await runAction(`answer-${question.question}`, async () => {
    if (kind === "step") await api.answerStepQuestion(question.question, answer, expectedVersion, csrfToken.value);
    else await api.answerContextQuestion(question.question, answer, expectedVersion, csrfToken.value);
    onSuccess();
  }, "Question answered. The original question and answer are preserved together.");
}

async function reviseQuestionAnswer({ kind, question, answer, expectedVersion, onSuccess }: { kind: "step" | "context"; question: StepQuestion | ContextQuestion; answer: string; expectedVersion: number; onSuccess: () => void }) {
  await runAction(`revise-${question.question}`, async () => {
    if (kind === "step") await api.reviseStepQuestionAnswer(question.question, answer, expectedVersion, csrfToken.value);
    else await api.reviseContextQuestionAnswer(question.question, answer, expectedVersion, csrfToken.value);
    onSuccess();
  }, "Answer updated. The original question and answer ownership are preserved.");
}

function formatIdentity(identity: string) { return identity.length > 13 ? `${identity.slice(0, 7)}…${identity.slice(-4)}` : identity; }

onMounted(async () => {
  try { await acceptSession(await api.session()); }
  catch (error) { showError(error); }
  finally {
    sessionChecked.value = true;
    refreshTimer = window.setInterval(() => { void refreshData(false, true); }, 3_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("beforeunload", preventUnsavedUnload);
  }
});

function refreshWhenVisible() {
  if (!document.hidden) void refreshData(false, true);
}

function preventUnsavedUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedWork.value) return;
  event.preventDefault();
  event.returnValue = "";
}

onUnmounted(() => {
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
  document.removeEventListener("visibilitychange", refreshWhenVisible);
  window.removeEventListener("beforeunload", preventUnsavedUnload);
});
</script>

<template>
  <main class="app-shell">
    <section v-if="!sessionChecked" class="loading-screen" aria-live="polite">
      <span class="brand-mark" aria-hidden="true">R</span><p>Connecting to your Relay workspace…</p>
    </section>
    <section v-else-if="!authenticated" class="sign-in-layout">
      <div class="sign-in-story">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">R</span><span>Relay</span></div>
        <p class="auth-context">Club knowledge, kept with the work</p><h1>Keep every handoff clear.</h1>
        <p class="story-copy">Write the steps, keep the reasoning, and know when something needs attention.</p>
        <div class="story-foot"><span class="status-dot"></span>Private club workspaces</div>
      </div>
      <form class="sign-in-card" @submit.prevent="signIn">
        <div class="card-kicker">{{ authMode === 'signin' ? 'Sign in' : 'Create account' }}</div><h2>{{ authMode === 'signin' ? 'Welcome back' : 'Join Relay' }}</h2>
        <label v-if="authMode === 'register'" for="display-name">Name</label><input v-if="authMode === 'register'" id="display-name" v-model="displayName" autocomplete="name" required maxlength="100" :disabled="loginBusy">
        <label for="email">Email</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" :disabled="loginBusy">
        <label for="password">Password</label><input id="password" v-model="password" type="password" :autocomplete="authMode === 'signin' ? 'current-password' : 'new-password'" required minlength="10" maxlength="128" :disabled="loginBusy">
        <button class="button button-primary button-wide" type="submit" :disabled="loginBusy">{{ loginBusy ? "Please wait…" : authMode === 'signin' ? "Sign in" : "Create account" }} <span aria-hidden="true">→</span></button>
        <button class="text-button auth-switch" type="button" :disabled="loginBusy" @click="authMode = authMode === 'signin' ? 'register' : 'signin'; clearMessages()">{{ authMode === 'signin' ? 'New to Relay? Create an account' : 'Already have an account? Sign in' }}</button>
        <p v-if="errorMessage" class="inline-error" role="alert">{{ errorMessage }}</p>
      </form>
    </section>
    <section v-else-if="!hasWorkspace" class="loading-screen onboarding-screen">
      <span class="brand-mark" aria-hidden="true">R</span><h1>Choose a club</h1><p>Create a new club or enter an invitation code.</p>
      <div v-if="workspaces.length" class="onboarding-card"><h2>Your clubs</h2><button v-for="club in workspaces" :key="club.workspace" class="button button-secondary button-wide" type="button" :disabled="!!actionBusy" @click="selectClub(club.workspace)">{{ club.name }} · {{ club.role }}</button></div>
      <form class="onboarding-card" @submit.prevent="createClub()"><h2>Create a club</h2><label for="club-name">Club name</label><input id="club-name" v-model="clubName" required maxlength="120" placeholder="Robotics Club"><button class="button button-primary button-wide" type="submit" :disabled="!!actionBusy || !clubName.trim()">{{ actionBusy === "create-workspace" ? "Creating…" : "Create as Owner" }}</button></form>
      <form class="onboarding-card" @submit.prevent="acceptInvitation()"><h2>Accept an invitation</h2><label for="invite-token">One-time invitation code</label><input id="invite-token" v-model="invitationToken" required maxlength="64" spellcheck="false"><button class="button button-primary button-wide" type="submit" :disabled="!!actionBusy || !invitationToken.trim()">{{ actionBusy === "accept-invitation" ? "Joining…" : "Join club" }}</button></form>
      <p v-if="errorMessage" class="inline-error" role="alert">{{ errorMessage }}</p><button class="text-button" type="button" @click="signOut">Sign out</button>
    </section>
    <div v-else class="workspace-layout">
      <aside class="sidebar">
        <a class="brand-lockup sidebar-brand" href="#" @click.prevent="navigate({ section: 'overview' })"><span class="brand-mark" aria-hidden="true">R</span><span>Relay</span></a>
        <div class="workspace-chip"><span><small>Current workspace</small><strong :title="workspace">{{ workspaceName || formatIdentity(workspace) }}</strong><small>{{ role }}</small></span><span class="workspace-online" aria-label="Connected"></span></div>
        <select v-if="workspaces.length > 1" class="workspace-select" :value="workspace" aria-label="Select club workspace" :disabled="!!actionBusy" @change="selectClub(($event.target as HTMLSelectElement).value, $event.target as HTMLSelectElement)"><option v-for="club in workspaces" :key="club.workspace" :value="club.workspace">{{ club.name }} · {{ club.role }}</option></select>
        <nav class="primary-nav" aria-label="Main navigation">
          <button v-for="item in navigation.filter((item) => (item.id !== 'reviews' || canReview) && (item.id !== 'questions' || canAnswer))" :key="item.id" type="button" class="nav-link" :class="{ active: section === item.id }" :aria-current="section === item.id ? 'page' : undefined" @click="navigate({ section: item.id })">
            <span>{{ item.label }}</span><span v-if="item.id === 'reviews' && unfinishedCount" class="nav-count">{{ unfinishedCount }}</span><span v-if="item.id === 'questions' && unansweredCount" class="nav-count">{{ unansweredCount }}</span>
          </button>
        </nav>
        <div class="sidebar-bottom"><div class="secure-note">{{ currentUser?.name }}</div><button type="button" class="sign-out-button" :disabled="!!actionBusy || refreshing" @click="signOut">Sign out</button></div>
      </aside>
      <section class="main-column">
        <header class="topbar">
          <div class="breadcrumb">{{ navigation.find((item) => item.id === section)?.label }}</div>
          <div class="topbar-actions"><button class="icon-button" type="button" :disabled="refreshing || !!actionBusy" aria-label="Refresh workspace" @click="refreshData(true)"><span :class="{ spinning: refreshing }" aria-hidden="true">↻</span></button><button class="mobile-sign-out" type="button" :disabled="!!actionBusy || refreshing" @click="signOut">Sign out</button></div>
        </header>
        <div class="content-area">
          <div v-if="errorMessage" class="flash flash-error" role="alert"><span aria-hidden="true">!</span><p>{{ errorMessage }}</p><button type="button" aria-label="Dismiss error" @click="errorMessage = ''">×</button></div>
          <div v-if="successMessage" class="flash flash-success" role="status"><span aria-hidden="true">✓</span><p>{{ successMessage }}</p><button type="button" aria-label="Dismiss message" @click="successMessage = ''">×</button></div>
          <OverviewView v-if="section === 'overview'" :procedures="procedures" :reviews="reviews" :step-questions="stepQuestions" :context-questions="contextQuestions" :activity="recentActivity" :can-edit="canEdit" :can-review="canReview" :can-answer="canAnswer" @navigate="navigate" />
          <PlaybooksView v-else-if="section === 'procedures'" :key="playbooksEditorKey" :procedures="procedures" :contexts="contexts" :step-questions="stepQuestions" :action-busy="actionBusy" :can-edit="canEdit" :can-edit-context="canEditContext" :focus-procedure="focusedProcedure" :focus-context-step="focusedContextStep" :start-create="startNewPlaybook" :review="focusedReview" @create="createProcedure" @add-step="addStep" @rename="renameProcedure" @edit-step="editStep" @move-step="moveStep" @remove-step="removeStep" @ask-question="askStepQuestion" @attach-context="attachStepContext" @record-context="recordStepContext" @archive="archiveProcedure" @return-to-review="returnToReview" @dirty-change="hasUnsavedWork = $event" />
          <ContextView v-else-if="section === 'context'" :contexts="contexts" :procedures="procedures" :context-questions="contextQuestions" :action-busy="actionBusy" :can-edit="canEditContext" :change-result="contextChangeResult" @record="recordContext" @attach="attachContext" @correct="correctContext" @change="changeContext" @ask-question="askContextQuestion" @validation-error="showValidationError" @review-affected="reviewAffectedPlaybooks" @dismiss-change-result="contextChangeResult = undefined" @dirty-change="hasUnsavedWork = $event" />
          <ReviewsView v-else-if="section === 'reviews'" :reviews="reviews" :review-history="reviewHistory" :procedures="procedures" :action-busy="actionBusy" :focus-review="focusedReviewId" @confirm="confirmReview" @require-changes="requireReviewChanges" @resolve="resolveReview" @cancel="cancelReview" @edit-playbook="editReviewedPlaybook" />
          <QuestionsView v-else-if="section === 'questions'" :step-questions="stepQuestions" :context-questions="contextQuestions" :action-busy="actionBusy" :can-answer="canAnswer" :current-user-id="currentUser?.id ?? ''" :focus-question="focusedQuestionId" :focus-kind="focusedQuestionKind" @answer="answerQuestion" @revise="reviseQuestionAnswer" @dirty-change="hasUnsavedWork = $event" />
          <WorkspaceView v-else :workspace="workspace" :workspace-name="workspaceName" :role="role" :user="currentUser" :workspaces="workspaces" :members="workspaceMembers" :pending-invitations="pendingInvitations" :can-invite="canEdit" :created-invite="createdInvite" :action-busy="actionBusy" :ownership-configured="ownershipConfigured" @create-club="createClub" @join-club="acceptInvitation" @invite="inviteMember" @reissue="reissueInvitation" @select="selectClub" @claim-ownership="claimOwnership" @change-role="changeMemberRole" @remove-member="removeWorkspaceMember" @transfer-ownership="transferOwnership" @dirty-change="hasUnsavedWork = $event" />
        </div>
      </section>
    </div>
  </main>
</template>
