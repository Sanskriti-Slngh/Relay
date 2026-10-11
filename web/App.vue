<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  createRelayApi,
  RelayApiError,
  type ContextNote,
  type PendingReview,
  type ProcedureReviewHistory,
  type Procedure,
} from "./api.ts";

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

const procedureTitle = ref("");
const stepDraft = reactive<Record<string, string>>({});
const contextDraft = ref("");
const correctionDraft = reactive<Record<string, string>>({});
const changeDraft = reactive<Record<string, string>>({});
const attachmentProcedure = reactive<Record<string, string>>({});
const attachmentStep = reactive<Record<string, string>>({});

const unfinishedCount = computed(() => reviews.value.length);
const completedReviews = computed(() =>
  reviewHistory.value.flatMap((procedure) =>
    procedure.reviews
      .filter((review) => review.status === "COMPLETE")
      .map((review) => ({
        ...review,
        procedure: procedure.procedure,
        title: procedure.title,
      })),
  ),
);
const activeProcedures = computed(() =>
  procedures.value.filter((procedure) => procedure.status === "ACTIVE"),
);
const archivedProcedures = computed(() =>
  procedures.value.filter((procedure) => procedure.status === "RETIRED"),
);
const navigation: { id: Section; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "01" },
  { id: "procedures", label: "Playbooks", short: "02" },
  { id: "context", label: "Shared context", short: "03" },
  { id: "reviews", label: "Reviews", short: "04" },
];

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

function showError(error: unknown) {
  if (error instanceof RelayApiError && error.status === 401) {
    authenticated.value = false;
    csrfToken.value = "";
    workspace.value = "";
  }
  errorMessage.value = error instanceof Error ? error.message : "Something went wrong. Try again.";
  successMessage.value = "";
}

async function refreshData(announce = false): Promise<boolean> {
  if (!csrfToken.value) return false;
  refreshing.value = true;
  clearMessages();
  try {
    const [procedureResult, contextResult, reviewResult, historyResult] = await Promise.all([
      api.procedures(csrfToken.value),
      api.contextHistory(csrfToken.value),
      api.pendingReviews(csrfToken.value),
      api.reviewHistory(csrfToken.value),
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
  } finally {
    refreshing.value = false;
  }
}

async function runAction(label: string, action: () => Promise<void>, success: string) {
  clearMessages();
  actionBusy.value = label;
  try {
    await action();
    const refreshed = await refreshData();
    successMessage.value = refreshed
      ? success
      : "The action completed, but the workspace could not refresh. Try Refresh.";
  } catch (error) {
    showError(error);
  } finally {
    actionBusy.value = "";
  }
}

async function signIn() {
  clearMessages();
  loginBusy.value = true;
  try {
    const session = await api.login(loginCredential.value);
    loginCredential.value = "";
    await acceptSession(session);
  } catch (error) {
    loginCredential.value = "";
    showError(error);
  } finally {
    loginBusy.value = false;
  }
}

async function acceptSession(session: { authenticated: boolean; csrfToken?: string; workspace?: string }) {
  authenticated.value = session.authenticated;
  csrfToken.value = session.csrfToken ?? "";
  workspace.value = session.workspace ?? "";
  if (authenticated.value) await refreshData();
}

async function signOut() {
  clearMessages();
  try {
    await api.logout(csrfToken.value);
  } catch (error) {
    showError(error);
    return;
  }
  authenticated.value = false;
  csrfToken.value = "";
  workspace.value = "";
  procedures.value = [];
  contexts.value = [];
  reviews.value = [];
  reviewHistory.value = [];
}

async function createProcedure() {
  const title = procedureTitle.value.trim();
  if (!title) return;
  await runAction("create-procedure", async () => {
    await api.createProcedure(title, csrfToken.value);
    procedureTitle.value = "";
    section.value = "procedures";
  }, "Playbook created.");
}

async function addStep(procedure: Procedure) {
  const text = (stepDraft[procedure.procedure] ?? "").trim();
  if (!text) return;
  await runAction(`step-${procedure.procedure}`, async () => {
    await api.addStep(procedure.procedure, text, csrfToken.value);
    stepDraft[procedure.procedure] = "";
  }, "Step added to the playbook.");
}

async function archiveProcedure(procedure: Procedure) {
  if (!window.confirm(`Archive "${procedure.title}"? It will leave the active Playbooks list. Its Steps, Context attachments, and Review history will be preserved.`)) {
    return;
  }
  await runAction(`archive-${procedure.procedure}`, async () => {
    await api.archiveProcedure(procedure.procedure, csrfToken.value);
  }, "Playbook archived. Its context and review history are preserved.");
}

async function recordContext() {
  const text = contextDraft.value.trim();
  if (!text) return;
  await runAction("record-context", async () => {
    await api.recordContextNote(text, csrfToken.value);
    contextDraft.value = "";
    section.value = "context";
  }, "Shared context note recorded.");
}

async function attachContext(note: ContextNote) {
  const procedure = attachmentProcedure[note.context] ?? "";
  const step = attachmentStep[note.context] ?? "";
  if (!procedure) {
    errorMessage.value = "Choose a playbook before attaching this note.";
    return;
  }
  await runAction(`attach-${note.context}`, async () => {
    if (step) {
      await api.attachContextNoteAtStep(note.context, procedure, step, csrfToken.value);
    } else {
      await api.attachContextNote(note.context, procedure, csrfToken.value);
    }
    attachmentStep[note.context] = "";
  }, "Context note attached.");
}

async function correctContext(note: ContextNote) {
  const text = (correctionDraft[note.context] ?? "").trim();
  if (!text) return;
  await runAction(`correct-${note.context}`, async () => {
    await api.correctContextNote(note.context, text, csrfToken.value);
    correctionDraft[note.context] = "";
  }, "Wording corrected. No review was created.");
}

async function changeContext(note: ContextNote) {
  const text = (changeDraft[note.context] ?? "").trim();
  if (!text) return;
  if (!window.confirm("Record this as a meaningful change? Attached active playbooks may receive a review.")) {
    return;
  }
  await runAction(`change-${note.context}`, async () => {
    await api.changeContextNote(note.context, text, csrfToken.value);
    changeDraft[note.context] = "";
  }, "Meaningful change recorded; affected review state has been refreshed.");
}

async function confirmReview(review: PendingReview) {
  if (!window.confirm(`Confirm that "${review.title}" has been reviewed?`)) return;
  await runAction(`review-${review.review}`, async () => {
    await api.confirmReview(review.review, review.procedure, csrfToken.value);
  }, "Review confirmed.");
}

function notesForProcedure(procedureId: string) {
  return contexts.value.filter((note) =>
    note.attachments.some((attachment) => attachment.subject === procedureId),
  );
}

function stepsForProcedure(procedureId: string) {
  return procedures.value.find((procedure) => procedure.procedure === procedureId)?.steps ?? [];
}

function titleForProcedure(procedureId: string) {
  return procedures.value.find((procedure) => procedure.procedure === procedureId)?.title ?? "Unknown playbook";
}

function formatIdentity(identity: string) {
  return identity.length > 13 ? `${identity.slice(0, 7)}…${identity.slice(-4)}` : identity;
}

onMounted(async () => {
  try {
    await acceptSession(await api.session());
  } catch (error) {
    showError(error);
  } finally {
    sessionChecked.value = true;
  }
});
</script>

<template>
  <main class="app-shell">
    <section v-if="!sessionChecked" class="loading-screen" aria-live="polite">
      <span class="brand-mark" aria-hidden="true">R</span>
      <p>Connecting to your Relay workspace…</p>
    </section>

    <section v-else-if="!authenticated" class="sign-in-layout">
      <div class="sign-in-story">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">R</span>
          <span>Relay</span>
        </div>
        <p class="eyebrow">CLUB OPERATIONS, IN CONTEXT</p>
        <h1>Keep the knowledge behind every playbook.</h1>
        <p class="story-copy">
          Preserve shared context, trace what changed, and make sure every affected procedure gets a thoughtful review.
        </p>
        <div class="story-foot">
          <span class="status-dot"></span>
          Local workspace · officer access
        </div>
      </div>
      <form class="sign-in-card" @submit.prevent="signIn">
        <div class="card-kicker">LOCAL OFFICER SIGN IN</div>
        <h2>Welcome to Relay</h2>
        <p>Enter the local access credential configured by your workspace administrator.</p>
        <label for="local-credential">Local access credential</label>
        <input
          id="local-credential"
          v-model="loginCredential"
          type="password"
          autocomplete="current-password"
          required
          spellcheck="false"
          :disabled="loginBusy"
        >
        <button class="button button-primary button-wide" type="submit" :disabled="loginBusy">
          {{ loginBusy ? "Signing in…" : "Sign in to workspace" }}
          <span aria-hidden="true">→</span>
        </button>
        <p class="privacy-note">Relay does not persist this credential. It is exchanged for a short-lived, same-site browser session.</p>
        <p v-if="errorMessage" class="inline-error" role="alert">{{ errorMessage }}</p>
      </form>
    </section>

    <div v-else class="workspace-layout">
      <aside class="sidebar">
        <a class="brand-lockup sidebar-brand" href="#" @click.prevent="section = 'overview'">
          <span class="brand-mark" aria-hidden="true">R</span>
          <span>Relay</span>
        </a>
        <div class="workspace-chip">
          <span class="workspace-symbol" aria-hidden="true">⌂</span>
          <span>
            <small>CLUB WORKSPACE</small>
            <strong :title="workspace">{{ formatIdentity(workspace) }}</strong>
          </span>
          <span class="workspace-online" aria-label="Connected"></span>
        </div>
        <nav class="primary-nav" aria-label="Main navigation">
          <span class="nav-heading">WORKSPACE</span>
          <button
            v-for="item in navigation"
            :key="item.id"
            type="button"
            class="nav-link"
            :class="{ active: section === item.id }"
            :aria-current="section === item.id ? 'page' : undefined"
            @click="section = item.id"
          >
            <span class="nav-number">{{ item.short }}</span>
            <span>{{ item.label }}</span>
            <span v-if="item.id === 'reviews' && unfinishedCount" class="nav-count">{{ unfinishedCount }}</span>
          </button>
        </nav>
        <div class="sidebar-bottom">
          <div class="secure-note"><span aria-hidden="true">◈</span> Private local session</div>
          <button type="button" class="sign-out-button" @click="signOut">Sign out <span aria-hidden="true">↗</span></button>
        </div>
      </aside>

      <section class="main-column">
        <header class="topbar">
          <div class="breadcrumb">Relay <span>/</span> {{ navigation.find((item) => item.id === section)?.label }}</div>
          <div class="topbar-actions">
            <span class="live-indicator"><span></span> Workspace connected</span>
            <button class="icon-button" type="button" :disabled="refreshing" aria-label="Refresh workspace" @click="refreshData(true)">
              <span :class="{ spinning: refreshing }" aria-hidden="true">↻</span>
            </button>
            <button class="mobile-sign-out" type="button" @click="signOut">Sign out</button>
          </div>
        </header>

        <div class="content-area">
          <div v-if="errorMessage" class="flash flash-error" role="alert">
            <span aria-hidden="true">!</span><p>{{ errorMessage }}</p>
            <button type="button" aria-label="Dismiss error" @click="errorMessage = ''">×</button>
          </div>
          <div v-if="successMessage" class="flash flash-success" role="status">
            <span aria-hidden="true">✓</span><p>{{ successMessage }}</p>
            <button type="button" aria-label="Dismiss message" @click="successMessage = ''">×</button>
          </div>

          <template v-if="section === 'overview'">
            <div class="page-heading heading-with-action">
              <div>
                <p class="eyebrow">YOUR CLUB, IN SYNC</p>
                <h1>Good to have you back.</h1>
                <p class="page-intro">A clear view of your club’s playbooks, shared context, and decisions to revisit.</p>
              </div>
              <button class="button button-primary" type="button" @click="section = 'procedures'">
                <span aria-hidden="true">＋</span> New playbook
              </button>
            </div>

            <div class="metric-grid" aria-label="Workspace summary">
              <article class="metric-card">
                <div class="metric-label"><span class="metric-icon icon-violet">↗</span> PLAYBOOKS</div>
                <strong>{{ activeProcedures.length }}</strong>
                <span class="metric-foot">{{ procedures.length === 1 ? "active procedure" : "active procedures" }}</span>
              </article>
              <article class="metric-card">
                <div class="metric-label"><span class="metric-icon icon-blue">▤</span> SHARED CONTEXT</div>
                <strong>{{ contexts.length }}</strong>
                <span class="metric-foot">notes kept with the work</span>
              </article>
              <article class="metric-card" :class="{ 'metric-attention': unfinishedCount > 0 }">
                <div class="metric-label"><span class="metric-icon icon-amber">◷</span> PENDING REVIEWS</div>
                <strong>{{ unfinishedCount }}</strong>
                <span class="metric-foot">{{ unfinishedCount ? "ready for officer review" : "nothing waiting right now" }}</span>
              </article>
            </div>

            <div class="overview-grid">
              <section class="panel panel-large">
                <div class="panel-heading">
                  <div><p class="eyebrow">THE WAY YOU WORK</p><h2>Playbooks</h2></div>
                  <button class="text-button" type="button" @click="section = 'procedures'">All playbooks <span>→</span></button>
                </div>
                <div v-if="!activeProcedures.length" class="empty-state compact-empty">
                  <span class="empty-icon">↗</span>
                  <h3>{{ archivedProcedures.length ? "No active playbooks" : "Start with a playbook" }}</h3>
                  <p>{{ archivedProcedures.length ? "Archived playbooks remain available below and in review history." : "Capture the repeatable steps your club relies on." }}</p>
                  <button class="button button-secondary" type="button" @click="section = 'procedures'">Create a playbook</button>
                </div>
                <div v-else class="overview-procedures">
                  <article v-for="procedure in activeProcedures.slice(0, 4)" :key="procedure.procedure" class="overview-procedure">
                    <span class="procedure-glyph">P</span>
                    <div class="procedure-summary">
                      <strong>{{ procedure.title }}</strong>
                      <small>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }} <span>·</span> {{ notesForProcedure(procedure.procedure).length }} context notes</small>
                    </div>
                    <span class="badge badge-active">{{ procedure.status === "ACTIVE" ? "Active" : procedure.status }}</span>
                  </article>
                </div>
              </section>

              <section class="panel">
                <div class="panel-heading">
                  <div><p class="eyebrow">NEEDS A LOOK</p><h2>Reviews</h2></div>
                  <button class="text-button" type="button" @click="section = 'reviews'">Open inbox <span>→</span></button>
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
                <div><p class="eyebrow">KNOWLEDGE THAT TRAVELS</p><h2>Recently shared context</h2></div>
                <button class="text-button" type="button" @click="section = 'context'">View context <span>→</span></button>
              </div>
              <div v-if="!contexts.length" class="empty-inline">No shared context notes yet. Add the background that helps your playbooks make sense.</div>
              <div v-else class="context-preview-grid">
                <article v-for="note in contexts.slice(0, 3)" :key="note.context" class="context-preview-card">
                  <span class="note-mark">“</span>
                  <p>{{ note.text }}</p>
                  <small>{{ note.attachments.length }} {{ note.attachments.length === 1 ? "playbook" : "playbooks" }} <span>·</span> {{ note.changes.length }} recorded changes</small>
                </article>
              </div>
            </section>
            <footer class="page-footer">Relay keeps club knowledge connected to the work it informs.</footer>
          </template>

          <template v-else-if="section === 'procedures'">
            <div class="page-heading">
              <p class="eyebrow">REPEATABLE WORK, MADE CLEAR</p>
              <h1>Playbooks</h1>
              <p class="page-intro">Document how your club gets things done, one ordered step at a time.</p>
            </div>
            <form class="create-bar" @submit.prevent="createProcedure">
              <label class="sr-only" for="procedure-title">New playbook title</label>
              <input id="procedure-title" v-model="procedureTitle" placeholder="Name a playbook…" required maxlength="160">
              <button class="button button-primary" type="submit" :disabled="actionBusy === 'create-procedure' || !procedureTitle.trim()">
                {{ actionBusy === "create-procedure" ? "Creating…" : "Create playbook" }}
              </button>
            </form>
            <div v-if="!activeProcedures.length" class="panel empty-page-state">
              <span class="empty-icon">↗</span><h2>{{ archivedProcedures.length ? "No active playbooks" : "Your first playbook starts here" }}</h2>
              <p>{{ archivedProcedures.length ? "There are no active playbooks. Archived ones remain available below." : "Give it a clear name above, then add the steps your team follows." }}</p>
            </div>
            <div v-if="activeProcedures.length" class="procedure-list">
              <article v-for="procedure in activeProcedures" :key="procedure.procedure" class="panel procedure-card">
                <header class="procedure-card-heading">
                  <span class="procedure-glyph large-glyph">P</span>
                  <div class="procedure-title-group"><span class="eyebrow">PLAYBOOK</span><h2>{{ procedure.title }}</h2></div>
                  <span class="badge badge-active">{{ procedure.status === "ACTIVE" ? "Active" : procedure.status }}</span>
                </header>
                <div class="steps-section">
                  <div class="section-rule"><span>ORDERED STEPS</span><span>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</span></div>
                  <ol v-if="procedure.steps.length" class="step-list">
                    <li v-for="step in procedure.steps" :key="step.step">
                      <span class="step-index">{{ String(step.position).padStart(2, "0") }}</span>
                      <span>{{ step.text }}</span>
                    </li>
                  </ol>
                  <p v-else class="subtle-empty">No steps added yet. Add the first one below.</p>
                  <form class="inline-form add-step-form" @submit.prevent="addStep(procedure)">
                    <label class="sr-only" :for="`step-${procedure.procedure}`">New step for {{ procedure.title }}</label>
                    <input :id="`step-${procedure.procedure}`" v-model="stepDraft[procedure.procedure]" placeholder="Describe the next step…" required maxlength="500">
                    <button class="button button-secondary" type="submit" :disabled="actionBusy === `step-${procedure.procedure}` || !(stepDraft[procedure.procedure] ?? '').trim()">
                      {{ actionBusy === `step-${procedure.procedure}` ? "Adding…" : "Add step" }}
                    </button>
                  </form>
                </div>
                <div class="associated-notes">
                  <div class="section-rule"><span>CONNECTED CONTEXT</span><span>{{ notesForProcedure(procedure.procedure).length }}</span></div>
                  <div v-if="notesForProcedure(procedure.procedure).length" class="associated-note-list">
                    <p v-for="note in notesForProcedure(procedure.procedure)" :key="note.context"><span>“</span>{{ note.text }}</p>
                  </div>
                  <p v-else class="subtle-empty">Shared notes attached to this playbook will appear here.</p>
                </div>
                <footer class="procedure-card-footer">
                  <button
                    class="button button-small button-secondary"
                    type="button"
                    :disabled="actionBusy === `archive-${procedure.procedure}`"
                    @click="archiveProcedure(procedure)"
                  >
                    {{ actionBusy === `archive-${procedure.procedure}` ? "Archiving…" : "Archive playbook" }}
                  </button>
                </footer>
              </article>
            </div>
            <details v-if="archivedProcedures.length" class="panel archived-playbooks">
              <summary>Archived playbooks <span class="badge badge-archived">{{ archivedProcedures.length }}</span></summary>
              <p class="archived-description">Archived playbooks are excluded from active lists. Their Steps, Context attachments, and Reviews are retained.</p>
              <article v-for="procedure in archivedProcedures" :key="procedure.procedure" class="archived-playbook">
                <div class="archived-playbook-heading">
                  <strong>{{ procedure.title }}</strong>
                  <span class="badge badge-archived">Archived</span>
                </div>
                <ol v-if="procedure.steps.length" class="step-list">
                  <li v-for="step in procedure.steps" :key="step.step">
                    <span class="step-index">{{ String(step.position).padStart(2, "0") }}</span>
                    <span>{{ step.text }}</span>
                  </li>
                </ol>
                <p v-else class="subtle-empty">This Playbook has no Steps.</p>
                <p class="archived-context-count">{{ notesForProcedure(procedure.procedure).length }} connected Context Notes · Review history remains available in Reviews.</p>
              </article>
            </details>
          </template>

          <template v-else-if="section === 'context'">
            <div class="page-heading">
              <p class="eyebrow">THE WHY BEHIND THE WORK</p>
              <h1>Shared context</h1>
              <p class="page-intro">Keep useful knowledge connected to the playbooks it informs. Correct wording or record a change in meaning—Relay treats them differently.</p>
            </div>
            <form class="record-context panel" @submit.prevent="recordContext">
              <div class="form-heading"><span class="context-form-icon">“</span><div><h2>Record a context note</h2><p>Capture a decision, constraint, or piece of history your club may need again.</p></div></div>
              <label class="sr-only" for="new-context">Context note</label>
              <textarea id="new-context" v-model="contextDraft" placeholder="Add the background worth carrying forward…" required maxlength="4000" rows="3"></textarea>
              <div class="form-foot"><span>Shared across this workspace</span><button class="button button-primary" type="submit" :disabled="actionBusy === 'record-context' || !contextDraft.trim()">{{ actionBusy === "record-context" ? "Saving…" : "Save context note" }}</button></div>
            </form>
            <div class="list-heading"><div><span class="eyebrow">WORKSPACE KNOWLEDGE</span><h2>{{ contexts.length }} {{ contexts.length === 1 ? "note" : "notes" }}</h2></div></div>
            <div v-if="!contexts.length" class="panel empty-page-state">
              <span class="empty-icon">▤</span><h2>Context makes the steps meaningful</h2>
              <p>Record a note above, then connect it to one or more playbooks or a specific step.</p>
            </div>
            <div v-else class="context-list">
              <article v-for="note in contexts" :key="note.context" class="panel context-card">
                <div class="context-card-main">
                  <span class="quote-mark" aria-hidden="true">“</span>
                  <div class="context-card-content">
                    <p class="context-current-text">{{ note.text }}</p>
                    <small>Context note <span>·</span> {{ note.changes.length }} {{ note.changes.length === 1 ? "recorded change" : "recorded changes" }}</small>
                  </div>
                </div>

                <div class="attachment-section">
                  <div class="section-rule"><span>ATTACHED TO</span><span>{{ note.attachments.length }}</span></div>
                  <div v-if="note.attachments.length" class="attachment-chips">
                    <span v-for="(attachment, index) in note.attachments" :key="`${attachment.subject}-${attachment.anchor ?? 'whole'}-${index}`" class="attachment-chip">
                      <span class="attachment-dot"></span>{{ titleForProcedure(attachment.subject) }}
                      <small v-if="attachment.anchor">· Step {{ stepsForProcedure(attachment.subject).find((step) => step.step === attachment.anchor)?.position ?? "" }}</small>
                    </span>
                  </div>
                  <p v-else class="subtle-empty">Not connected to a playbook yet.</p>
                  <form v-if="activeProcedures.length" class="attach-form" @submit.prevent="attachContext(note)">
                    <label class="sr-only" :for="`procedure-for-${note.context}`">Choose a playbook</label>
                    <select :id="`procedure-for-${note.context}`" v-model="attachmentProcedure[note.context]" required>
                      <option value="" disabled>Choose a playbook…</option>
                      <option v-for="procedure in activeProcedures" :key="procedure.procedure" :value="procedure.procedure">{{ procedure.title }}</option>
                    </select>
                    <label class="sr-only" :for="`step-for-${note.context}`">Optional step anchor</label>
                    <select :id="`step-for-${note.context}`" v-model="attachmentStep[note.context]" :disabled="!attachmentProcedure[note.context] || !stepsForProcedure(attachmentProcedure[note.context]).length">
                      <option value="">Whole playbook</option>
                      <option v-for="step in stepsForProcedure(attachmentProcedure[note.context] ?? '')" :key="step.step" :value="step.step">Step {{ step.position }} · {{ step.text }}</option>
                    </select>
                    <button class="button button-small button-secondary" type="submit" :disabled="actionBusy === `attach-${note.context}` || !attachmentProcedure[note.context]">
                      {{ actionBusy === `attach-${note.context}` ? "Attaching…" : "Attach" }}
                    </button>
                  </form>
                  <p v-else-if="!activeProcedures.length" class="subtle-empty">Create an active playbook before attaching context.</p>
                </div>

                <details v-if="note.changes.length" class="history-section">
                  <summary><span class="history-icon" aria-hidden="true">↺</span> Change history <span class="history-count">{{ note.changes.length }}</span></summary>
                  <ol class="change-history">
                    <li v-for="change in note.changes" :key="change.change">
                      <div><span class="change-label">BEFORE</span><p>{{ change.before }}</p></div>
                      <span class="change-arrow" aria-hidden="true">↓</span>
                      <div><span class="change-label">AFTER</span><p>{{ change.after }}</p></div>
                    </li>
                  </ol>
                </details>

                <div class="note-actions">
                  <form class="note-action-form" @submit.prevent="correctContext(note)">
                    <label :for="`correct-${note.context}`">Correct wording <span>· does not create a review</span></label>
                    <div class="action-input-row">
                      <input :id="`correct-${note.context}`" v-model="correctionDraft[note.context]" placeholder="Revised wording…" required maxlength="4000">
                      <button class="button button-small button-secondary" type="submit" :disabled="actionBusy === `correct-${note.context}` || !(correctionDraft[note.context] ?? '').trim()">Correct</button>
                    </div>
                  </form>
                  <form class="note-action-form meaningful-change-form" @submit.prevent="changeContext(note)">
                    <label :for="`change-${note.context}`">Meaningful change <span>· preserves before and after</span></label>
                    <div class="action-input-row">
                      <input :id="`change-${note.context}`" v-model="changeDraft[note.context]" placeholder="What changed in meaning?…" required maxlength="4000">
                      <button class="button button-small button-change" type="submit" :disabled="actionBusy === `change-${note.context}` || !(changeDraft[note.context] ?? '').trim()">{{ actionBusy === `change-${note.context}` ? "Saving…" : "Record change" }}</button>
                    </div>
                  </form>
                </div>
              </article>
            </div>
          </template>

          <template v-else>
            <div class="page-heading heading-with-action">
              <div>
                <p class="eyebrow">CLOSE THE LOOP</p>
                <h1>Review inbox</h1>
                <p class="page-intro">See what changed, understand the cause, and confirm when a playbook has been reconsidered.</p>
              </div>
              <span class="inbox-count">{{ reviews.length }} pending</span>
            </div>
            <div class="review-context-banner"><span class="banner-icon">◷</span><p><strong>Meaningful changes create reviews.</strong> Each pending review includes the exact before-and-after text that prompted it.</p></div>
            <div v-if="!reviews.length" class="panel empty-page-state review-empty">
              <span class="empty-icon empty-icon-green">✓</span><h2>Your review inbox is clear</h2>
              <p>When shared context changes in a way that affects a playbook, it will appear here.</p>
              <button class="button button-secondary" type="button" @click="section = 'context'">Browse shared context</button>
            </div>
            <div v-else class="review-list">
              <article v-for="review in reviews" :key="review.review" class="panel review-card">
                <div class="review-card-top">
                  <div class="review-title-wrap"><span class="review-symbol" aria-hidden="true">↻</span><div><span class="eyebrow">PLAYBOOK REVIEW</span><h2>{{ review.title }}</h2><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "change" : "changes" }} to consider</small></div></div>
                  <span class="badge badge-pending"><span class="pending-dot"></span> Pending</span>
                </div>
                <div class="causes-heading"><span>CAUSES</span><span>{{ review.causes.length }}</span></div>
                <article v-for="cause in review.causes" :key="cause.cause" class="cause-card">
                  <div class="cause-label"><span class="cause-dot"></span> CONTEXT CHANGE</div>
                  <div class="cause-diff">
                    <div class="diff-before"><span>BEFORE</span><p>{{ cause.before }}</p></div>
                    <span class="diff-arrow" aria-hidden="true">→</span>
                    <div class="diff-after"><span>AFTER</span><p>{{ cause.after }}</p></div>
                  </div>
                </article>
                <div v-if="!review.causes.length" class="subtle-empty cause-empty">No cause text is available for this review.</div>
                <footer class="review-card-footer">
                  <span>Confirm after the playbook has been reconsidered.</span>
                  <button class="button button-primary" type="button" :disabled="actionBusy === `review-${review.review}`" @click="confirmReview(review)">
                    {{ actionBusy === `review-${review.review}` ? "Confirming…" : "Confirm review" }} <span aria-hidden="true">✓</span>
                  </button>
                </footer>
              </article>
            </div>
            <section v-if="completedReviews.length" class="panel completed-history">
              <div class="panel-heading">
                <div><p class="eyebrow">CLOSED THE LOOP</p><h2>Completed reviews</h2></div>
                <span class="badge badge-complete">{{ completedReviews.length }} complete</span>
              </div>
              <article v-for="review in completedReviews" :key="review.review" class="completed-review">
                <div class="completed-review-heading">
                  <div><strong>{{ review.title }}</strong><small>{{ review.causes.length }} {{ review.causes.length === 1 ? "cause reviewed" : "causes reviewed" }}</small></div>
                  <span class="badge badge-complete">Complete</span>
                </div>
                <div v-for="cause in review.causes" :key="cause.cause" class="completed-cause">
                  <span>{{ cause.before }}</span><span aria-hidden="true">→</span><strong>{{ cause.after }}</strong>
                </div>
              </article>
            </section>
          </template>
        </div>
      </section>
    </div>
  </main>
</template>
