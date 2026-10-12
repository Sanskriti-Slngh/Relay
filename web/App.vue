<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createRelayApi, RelayApiError, type ContextNote, type PendingReview, type Procedure, type ProcedureReviewHistory } from "./api.ts";
import ContextView from "./components/ContextView.vue";
import OverviewView from "./components/OverviewView.vue";
import PlaybooksView from "./components/PlaybooksView.vue";
import ReviewsView from "./components/ReviewsView.vue";

type Section = "overview" | "procedures" | "context" | "reviews";

const api = createRelayApi();
const section = ref<Section>("overview");
const authenticated = ref(false);
const sessionChecked = ref(false);
const workspace = ref("");
const csrfToken = ref("");
const loginCredential = ref("");
const loginBusy = ref(false);
const refreshing = ref(false);
const actionBusy = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const procedures = ref<Procedure[]>([]);
const contexts = ref<ContextNote[]>([]);
const reviews = ref<PendingReview[]>([]);
const reviewHistory = ref<ProcedureReviewHistory[]>([]);

const unfinishedCount = computed(() => reviews.value.length);
const navigation: { id: Section; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "01" },
  { id: "procedures", label: "Playbooks", short: "02" },
  { id: "context", label: "Shared context", short: "03" },
  { id: "reviews", label: "Reviews", short: "04" },
];

function clearMessages() { errorMessage.value = ""; successMessage.value = ""; }

function clearWorkspaceState() {
  authenticated.value = false;
  csrfToken.value = "";
  workspace.value = "";
  procedures.value = [];
  contexts.value = [];
  reviews.value = [];
  reviewHistory.value = [];
}

function showError(error: unknown) {
  if (error instanceof RelayApiError && (error.status === 401 || error.code === "CSRF_REJECTED")) clearWorkspaceState();
  errorMessage.value = error instanceof Error ? error.message : "Something went wrong. Try again.";
  successMessage.value = "";
}

function showValidationError(message: string) { clearMessages(); errorMessage.value = message; }

async function refreshData(announce = false): Promise<boolean> {
  if (!csrfToken.value) return false;
  refreshing.value = true;
  clearMessages();
  try {
    const [procedureResult, contextResult, reviewResult, historyResult] = await Promise.all([
      api.procedures(csrfToken.value), api.contextHistory(csrfToken.value),
      api.pendingReviews(csrfToken.value), api.reviewHistory(csrfToken.value),
    ]);
    procedures.value = procedureResult.procedures;
    contexts.value = contextResult.contexts;
    reviews.value = reviewResult.reviews;
    reviewHistory.value = historyResult.procedures;
    if (announce) successMessage.value = "Workspace information is up to date.";
    return true;
  } catch (error) {
    showError(error);
    return false;
  } finally { refreshing.value = false; }
}

async function runAction(label: string, action: () => Promise<void>, success: string) {
  clearMessages();
  actionBusy.value = label;
  try {
    await action();
    const refreshed = await refreshData();
    successMessage.value = refreshed ? success : "The action completed, but the workspace could not refresh. Try Refresh.";
  } catch (error) { showError(error); }
  finally { actionBusy.value = ""; }
}

async function acceptSession(session: { authenticated: boolean; csrfToken?: string; workspace?: string }) {
  authenticated.value = session.authenticated;
  csrfToken.value = session.csrfToken ?? "";
  workspace.value = session.workspace ?? "";
  if (authenticated.value) await refreshData();
}

async function signIn() {
  clearMessages(); loginBusy.value = true;
  try {
    const session = await api.login(loginCredential.value);
    loginCredential.value = "";
    await acceptSession(session);
  } catch (error) { loginCredential.value = ""; showError(error); }
  finally { loginBusy.value = false; }
}

async function signOut() {
  clearMessages();
  try { await api.logout(csrfToken.value); }
  catch (error) { showError(error); return; }
  clearWorkspaceState();
}

async function createProcedure({ title, onSuccess }: { title: string; onSuccess: () => void }) {
  await runAction("create-procedure", async () => { await api.createProcedure(title, csrfToken.value); onSuccess(); section.value = "procedures"; }, "Playbook created.");
}

async function addStep({ procedure, text, onSuccess }: { procedure: Procedure; text: string; onSuccess: () => void }) {
  await runAction(`step-${procedure.procedure}`, async () => { await api.addStep(procedure.procedure, text, csrfToken.value); onSuccess(); }, "Step added to the playbook.");
}

async function archiveProcedure(procedure: Procedure) {
  if (!window.confirm(`Archive "${procedure.title}"? It will leave the active Playbooks list. Its Steps, Context attachments, and Review history will be preserved.`)) return;
  await runAction(`archive-${procedure.procedure}`, async () => { await api.archiveProcedure(procedure.procedure, csrfToken.value); }, "Playbook archived. Its context and review history are preserved.");
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

async function correctContext({ note, text, onSuccess }: { note: ContextNote; text: string; onSuccess: () => void }) {
  await runAction(`correct-${note.context}`, async () => { await api.correctContextNote(note.context, text, csrfToken.value); onSuccess(); }, "Wording corrected. No review was created.");
}

async function changeContext({ note, text, onSuccess }: { note: ContextNote; text: string; onSuccess: () => void }) {
  if (!window.confirm("Record this as a meaningful change? Attached active playbooks may receive a review.")) return;
  await runAction(`change-${note.context}`, async () => { await api.changeContextNote(note.context, text, csrfToken.value); onSuccess(); }, "Meaningful change recorded; affected review state has been refreshed.");
}

async function confirmReview(review: PendingReview) {
  if (!window.confirm(`Confirm that "${review.title}" has been reviewed?`)) return;
  await runAction(`review-${review.review}`, async () => { await api.confirmReview(review.review, review.procedure, csrfToken.value); }, "Review confirmed.");
}

function formatIdentity(identity: string) { return identity.length > 13 ? `${identity.slice(0, 7)}…${identity.slice(-4)}` : identity; }

onMounted(async () => {
  try { await acceptSession(await api.session()); }
  catch (error) { showError(error); }
  finally { sessionChecked.value = true; }
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
        <p class="eyebrow">CLUB OPERATIONS, IN CONTEXT</p><h1>Keep the knowledge behind every playbook.</h1>
        <p class="story-copy">Preserve shared context, trace what changed, and make sure every affected procedure gets a thoughtful review.</p>
        <div class="story-foot"><span class="status-dot"></span>Local workspace · officer access</div>
      </div>
      <form class="sign-in-card" @submit.prevent="signIn">
        <div class="card-kicker">LOCAL OFFICER SIGN IN</div><h2>Welcome to Relay</h2><p>Enter the local access credential configured by your workspace administrator.</p>
        <label for="local-credential">Local access credential</label>
        <input id="local-credential" v-model="loginCredential" type="password" autocomplete="current-password" required spellcheck="false" :disabled="loginBusy">
        <button class="button button-primary button-wide" type="submit" :disabled="loginBusy">{{ loginBusy ? "Signing in…" : "Sign in to workspace" }} <span aria-hidden="true">→</span></button>
        <p class="privacy-note">Relay does not persist this credential. It is exchanged for a short-lived, same-site browser session.</p>
        <p v-if="errorMessage" class="inline-error" role="alert">{{ errorMessage }}</p>
      </form>
    </section>
    <div v-else class="workspace-layout">
      <aside class="sidebar">
        <a class="brand-lockup sidebar-brand" href="#" @click.prevent="section = 'overview'"><span class="brand-mark" aria-hidden="true">R</span><span>Relay</span></a>
        <div class="workspace-chip"><span class="workspace-symbol" aria-hidden="true">⌂</span><span><small>CLUB WORKSPACE</small><strong :title="workspace">{{ formatIdentity(workspace) }}</strong></span><span class="workspace-online" aria-label="Connected"></span></div>
        <nav class="primary-nav" aria-label="Main navigation">
          <span class="nav-heading">WORKSPACE</span>
          <button v-for="item in navigation" :key="item.id" type="button" class="nav-link" :class="{ active: section === item.id }" :aria-current="section === item.id ? 'page' : undefined" @click="section = item.id">
            <span class="nav-number">{{ item.short }}</span><span>{{ item.label }}</span><span v-if="item.id === 'reviews' && unfinishedCount" class="nav-count">{{ unfinishedCount }}</span>
          </button>
        </nav>
        <div class="sidebar-bottom"><div class="secure-note"><span aria-hidden="true">◈</span> Private local session</div><button type="button" class="sign-out-button" @click="signOut">Sign out <span aria-hidden="true">↗</span></button></div>
      </aside>
      <section class="main-column">
        <header class="topbar">
          <div class="breadcrumb">Relay <span>/</span> {{ navigation.find((item) => item.id === section)?.label }}</div>
          <div class="topbar-actions"><span class="live-indicator"><span></span> Workspace connected</span><button class="icon-button" type="button" :disabled="refreshing" aria-label="Refresh workspace" @click="refreshData(true)"><span :class="{ spinning: refreshing }" aria-hidden="true">↻</span></button><button class="mobile-sign-out" type="button" @click="signOut">Sign out</button></div>
        </header>
        <div class="content-area">
          <div v-if="errorMessage" class="flash flash-error" role="alert"><span aria-hidden="true">!</span><p>{{ errorMessage }}</p><button type="button" aria-label="Dismiss error" @click="errorMessage = ''">×</button></div>
          <div v-if="successMessage" class="flash flash-success" role="status"><span aria-hidden="true">✓</span><p>{{ successMessage }}</p><button type="button" aria-label="Dismiss message" @click="successMessage = ''">×</button></div>
          <OverviewView v-if="section === 'overview'" :procedures="procedures" :contexts="contexts" :reviews="reviews" @navigate="section = $event" />
          <PlaybooksView v-else-if="section === 'procedures'" :procedures="procedures" :contexts="contexts" :action-busy="actionBusy" @create="createProcedure" @add-step="addStep" @archive="archiveProcedure" />
          <ContextView v-else-if="section === 'context'" :contexts="contexts" :procedures="procedures" :action-busy="actionBusy" @record="recordContext" @attach="attachContext" @correct="correctContext" @change="changeContext" @validation-error="showValidationError" />
          <ReviewsView v-else :reviews="reviews" :review-history="reviewHistory" :action-busy="actionBusy" @confirm="confirmReview" @browse-context="section = 'context'" />
        </div>
      </section>
    </div>
  </main>
</template>
