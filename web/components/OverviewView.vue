<script setup lang="ts">
import { computed } from "vue";
import type { ActivityEvent, ContextQuestion, PendingReview, Procedure, StepQuestion } from "../api.ts";
import { activityDescription, activityProcedureTarget, formatActivityRelativeTime } from "../activity.ts";
import { balancedAttentionItems } from "../attention.ts";

type OverviewTarget = {
  section: "procedures" | "reviews" | "questions";
  procedure?: string;
  review?: string;
  question?: string;
  questionKind?: "step" | "context";
  createPlaybook?: boolean;
};

type AttentionItem =
  | { kind: "review"; id: string; title: string; detail: string }
  | { kind: "question"; id: string; title: string; detail: string; questionKind: "step" | "context" };

const props = defineProps<{
  procedures: Procedure[];
  reviews: PendingReview[];
  stepQuestions: StepQuestion[];
  contextQuestions: ContextQuestion[];
  activity: ActivityEvent[];
  canEdit: boolean;
  canReview: boolean;
  canAnswer: boolean;
}>();
const emit = defineEmits<{ navigate: [target: OverviewTarget] }>();

const activeProcedures = computed(() => props.procedures.filter(({ status }) => status === "ACTIVE"));
const firstRun = computed(() => !activeProcedures.value.length);
const reviewItems = computed<AttentionItem[]>(() => props.canReview
  ? [...props.reviews]
    .sort((left, right) => Number(right.status === "CHANGES_REQUIRED") - Number(left.status === "CHANGES_REQUIRED"))
    .map((review) => ({
      kind: "review" as const,
      id: review.review,
      title: review.title,
      detail: review.status === "CHANGES_REQUIRED" ? "Playbook changes required" : "Shared context changed",
    }))
  : []);
const questionItems = computed<AttentionItem[]>(() => props.canAnswer
  ? [
    ...props.stepQuestions.filter(({ status }) => status === "OPEN").map((question) => ({
      kind: "question" as const,
      id: question.question,
      title: question.text,
      detail: `${question.title} · Step`,
      questionKind: "step" as const,
    })),
    ...props.contextQuestions.filter(({ status }) => status === "OPEN").map((question) => ({
      kind: "question" as const,
      id: question.question,
      title: question.text,
      detail: `Shared context · ${question.subjectText}`,
      questionKind: "context" as const,
    })),
  ]
  : []);
const attentionItems = computed(() => balancedAttentionItems(reviewItems.value, questionItems.value, 4));
const hasAttention = computed(() => attentionItems.value.length > 0);
const visiblePlaybooks = computed(() => activeProcedures.value.slice(0, 6));

function openAttentionItem(item: AttentionItem) {
  if (item.kind === "review") {
    emit("navigate", { section: "reviews", review: item.id });
    return;
  }
  emit("navigate", { section: "questions", question: item.id, questionKind: item.questionKind });
}

function playbookHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(hash) % 8;
}
function fullTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" }).format(new Date(value));
}
</script>

<template>
  <header class="page-heading overview-heading heading-with-action">
    <h1>Overview</h1>
    <button v-if="canEdit && !firstRun" class="button button-primary" type="button" @click="emit('navigate', { section: 'procedures', createPlaybook: true })">+ New playbook</button>
  </header>

  <div class="overview-grid" :class="{ 'has-attention': hasAttention }">
    <section v-if="firstRun" class="first-run overview-first-run">
      <h2>{{ canEdit ? "Create your first playbook" : "No playbooks yet" }}</h2>
      <p>{{ canEdit ? "Start with one recurring club task. Relay keeps its instructions and the reasons behind them together." : "An Officer can add the first Playbook. Once it is ready, you will be able to read its Steps and ask Questions beside them." }}</p>
      <ol v-if="canEdit" class="first-run-steps" aria-label="How Relay works">
        <li><strong>Write the task as ordered Steps.</strong><span>The result is a Playbook your club can follow.</span></li>
        <li><strong>Add Context beside a Step when the reason may change.</strong><span>The same Note can support more than one Playbook.</span></li>
        <li><strong>Review affected Playbooks when that information changes.</strong><span>Relay finds them; an Officer decides what needs updating.</span></li>
      </ol>
      <button v-if="canEdit" class="button button-primary" type="button" @click="emit('navigate', { section: 'procedures' })">Create your first playbook</button>
    </section>
    <section v-else class="overview-playbooks" aria-labelledby="overview-playbooks-title">
      <header class="overview-section-header">
        <div><h2 id="overview-playbooks-title">Playbooks</h2><p>{{ activeProcedures.length }} active</p></div>
        <button class="text-button" type="button" @click="emit('navigate', { section: 'procedures' })">View all</button>
      </header>
      <div class="overview-playbook-list">
        <button v-for="procedure in visiblePlaybooks" :key="procedure.procedure" class="overview-playbook-row" type="button" @click="emit('navigate', { section: 'procedures', procedure: procedure.procedure })">
          <span class="playbook-identifier" :class="`playbook-hue-${playbookHue(procedure.procedure)}`" aria-hidden="true">{{ procedure.title.trim().charAt(0).toUpperCase() || "P" }}</span>
          <span class="playbook-row-copy"><strong>{{ procedure.title }}</strong><small>{{ procedure.steps.length }} {{ procedure.steps.length === 1 ? "step" : "steps" }}</small></span>
          <span class="playbook-row-arrow" aria-hidden="true">→</span>
        </button>
      </div>
      <p v-if="activeProcedures.length > visiblePlaybooks.length" class="overview-list-note">{{ activeProcedures.length - visiblePlaybooks.length }} more in Playbooks</p>
    </section>

    <div class="overview-sidebar">
      <aside class="overview-attention" :class="{ 'is-empty': !hasAttention }" aria-labelledby="overview-attention-title">
        <header class="attention-panel-header"><h2 id="overview-attention-title">Needs attention</h2><span v-if="hasAttention">{{ reviewItems.length + questionItems.length }}</span></header>
        <div v-if="hasAttention" class="attention-item-list">
          <button v-for="item in attentionItems" :key="`${item.kind}-${item.id}`" class="attention-item" :class="`attention-item-${item.kind}`" type="button" @click="openAttentionItem(item)">
            <span class="attention-item-kind">{{ item.kind === "review" ? "Review" : "Question" }}</span>
            <strong :class="{ 'clamped-copy': item.kind === 'question' }">{{ item.title }}</strong>
            <small class="clamped-source">{{ item.detail }}</small>
          </button>
        </div>
        <p v-else class="attention-clear"><span aria-hidden="true">✓</span> All caught up</p>
        <footer v-if="hasAttention" class="attention-panel-links">
          <button v-if="reviewItems.length" class="text-button" type="button" @click="emit('navigate', { section: 'reviews' })">All reviews</button>
          <button v-if="questionItems.length" class="text-button" type="button" @click="emit('navigate', { section: 'questions' })">All questions</button>
        </footer>
      </aside>

      <section v-if="canEdit" class="recent-activity" aria-labelledby="recent-activity-title">
        <header class="recent-activity-header"><h2 id="recent-activity-title">Recent activity</h2></header>
        <div v-if="activity.length" class="activity-list">
          <details
            v-for="event in activity"
            :key="event.event"
            class="activity-row"
          >
            <summary :title="activityDescription(event)">
              <span class="activity-marker" aria-hidden="true"></span>
              <span class="activity-copy">
                <strong>{{ activityDescription(event) }}</strong>
                <time :datetime="event.occurredAt" :title="fullTimestamp(event.occurredAt)">{{ formatActivityRelativeTime(event.occurredAt) }}</time>
              </span>
              <span class="activity-disclosure" aria-hidden="true"><span class="activity-more">More</span><span class="activity-less">Less</span></span>
            </summary>
            <div class="activity-detail">
              <time :datetime="event.occurredAt">{{ fullTimestamp(event.occurredAt) }}</time>
              <button v-if="activityProcedureTarget(event)" class="text-button" type="button" @click="emit('navigate', { section: 'procedures', procedure: activityProcedureTarget(event) })">Open playbook</button>
            </div>
          </details>
        </div>
        <p v-else class="activity-empty">No activity yet</p>
      </section>
    </div>
  </div>
</template>
