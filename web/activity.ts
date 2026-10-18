import type { ActivityEvent } from "./api.ts";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function activityProcedureTarget(event: ActivityEvent): string | undefined {
  return event.procedure;
}

export function activityDescription(event: ActivityEvent): string {
  const title = event.procedureTitle ?? "a playbook";
  const step = event.stepPosition ? `Step ${event.stepPosition}` : "a Step";
  const target = event.targetName ?? "a member";
  if (event.type === "MEMBER_PROMOTED") return `${event.actorName} made ${target} an Officer`;
  if (event.type === "OFFICER_DEMOTED") return `${event.actorName} made ${target} a Member`;
  if (event.type === "MEMBER_REMOVED") return `${event.actorName} removed ${target} from the workspace`;
  if (event.type === "OWNERSHIP_CLAIMED") return `${event.actorName} became the workspace Owner`;
  if (event.type === "OWNERSHIP_TRANSFERRED") return `${event.actorName} transferred ownership to ${target}`;
  if (event.type === "PLAYBOOK_CREATED") return `${event.actorName} created ${title}`;
  if (event.type === "PLAYBOOK_RENAMED") return `${event.actorName} renamed a playbook to ${title}`;
  if (event.type === "PLAYBOOK_ARCHIVED") return `${event.actorName} archived ${title}`;
  if (event.type === "STEP_ADDED") return `${event.actorName} added ${step} in ${title}`;
  if (event.type === "STEP_EDITED") return `${event.actorName} edited ${step} in ${title}`;
  if (event.type === "STEP_REMOVED") return `${event.actorName} removed ${step} from ${title}`;
  if (event.type === "CONTEXT_CREATED") return `${event.actorName} created a shared context note`;
  if (event.type === "CONTEXT_ATTACHED") return event.stepPosition
    ? `${event.actorName} added context to Step ${event.stepPosition} in ${title}`
    : `${event.actorName} added context to ${title}`;
  if (event.type === "REVIEW_CONFIRMED") return `${event.actorName} confirmed a review for ${title}`;
  if (event.type === "REVIEW_RESOLVED") return `${event.actorName} resolved a review for ${title}`;
  if (event.type === "QUESTION_ANSWERED") return event.procedureTitle
    ? `${event.actorName} answered a question in ${title}`
    : `${event.actorName} answered a shared context question`;
  return event.procedureTitle
    ? `${event.actorName} updated shared context for ${title}`
    : `${event.actorName} updated shared context`;
}

export function formatActivityRelativeTime(value: string, now = Date.now()): string {
  const elapsedSeconds = Math.round((new Date(value).getTime() - now) / 1_000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800],
    ["day", 86_400], ["hour", 3_600], ["minute", 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(elapsedSeconds) >= seconds) return relativeTime.format(Math.round(elapsedSeconds / seconds), unit);
  }
  return "just now";
}
