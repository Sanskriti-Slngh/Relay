import type { Attachment, ContextNote, Step } from "./api.ts";

export interface ReviewContextScope {
  contextFound: boolean;
  found: boolean;
  wholePlaybook: boolean;
  stepIds: string[];
}

export interface ReviewContextConnection {
  note: ContextNote;
  attachment: Attachment;
}

export function stepForReviewRepair(
  anchor: string | null | undefined,
  steps: Step[],
  selectedStepId = "",
): Step | undefined {
  if (anchor === undefined) return undefined;
  if (anchor === null) return steps.find(({ step }) => step === selectedStepId) ?? steps[0];
  return steps.find(({ step }) => step === anchor);
}

export function contextConnectionsForReview(
  causeIds: string[],
  procedureId: string,
  contexts: ContextNote[],
): ReviewContextConnection[] {
  const causes = new Set(causeIds);
  const seen = new Set<string>();
  return contexts.flatMap((note) => {
    if (!note.changes.some(({ change }) => causes.has(change))) return [];
    return note.attachments
      .filter(({ attachment, subject }) => subject === procedureId && !seen.has(attachment))
      .map((attachment) => {
        seen.add(attachment.attachment);
        return { note, attachment };
      });
  });
}

export function contextScopeForReviewCause(
  causeId: string,
  procedureId: string,
  contexts: ContextNote[],
): ReviewContextScope {
  const context = contexts.find((note) => note.changes.some((change) => change.change === causeId));
  if (!context) return { contextFound: false, found: false, wholePlaybook: false, stepIds: [] };

  const attachments = context.attachments.filter((attachment) => attachment.subject === procedureId);
  return {
    contextFound: true,
    found: attachments.length > 0,
    wholePlaybook: attachments.some((attachment) => attachment.anchor === null),
    stepIds: [...new Set(attachments.flatMap((attachment) => attachment.anchor === null ? [] : [attachment.anchor]))],
  };
}
