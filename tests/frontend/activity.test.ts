import { describe, expect, test } from "bun:test";
import { activityDescription, activityProcedureTarget, formatActivityRelativeTime } from "../../web/activity.ts";
import type { ActivityEvent } from "../../web/api.ts";

const baseEvent: ActivityEvent = {
  event: "event-1",
  actor: "user-1",
  actorName: "Maya",
  type: "STEP_EDITED",
  occurredAt: "2026-10-18T16:42:00.000Z",
  procedure: "procedure-1",
  procedureTitle: "Book Rehearsal Space",
  step: "step-1",
  stepPosition: 2,
};

describe("Overview activity presentation", () => {
  test("describes the actor, action, Step, and Playbook", () => {
    expect(activityDescription(baseEvent)).toBe("Maya edited Step 2 in Book Rehearsal Space");
    expect(activityDescription({
      ...baseEvent,
      type: "CONTEXT_CHANGED",
      step: undefined,
      stepPosition: undefined,
    })).toBe("Maya updated shared context for Book Rehearsal Space");
  });

  test("uses concise descriptions for the extended meaningful events", () => {
    expect(activityDescription({ ...baseEvent, type: "PLAYBOOK_ARCHIVED" }))
      .toBe("Maya archived Book Rehearsal Space");
    expect(activityDescription({ ...baseEvent, type: "CONTEXT_CREATED", procedure: undefined, procedureTitle: undefined }))
      .toBe("Maya created a shared context note");
    expect(activityDescription({ ...baseEvent, type: "CONTEXT_ATTACHED" }))
      .toBe("Maya added context to Step 2 in Book Rehearsal Space");
    expect(activityDescription({ ...baseEvent, type: "REVIEW_CONFIRMED" }))
      .toBe("Maya confirmed a review for Book Rehearsal Space");
    expect(activityDescription({ ...baseEvent, type: "REVIEW_RESOLVED" }))
      .toBe("Maya resolved a review for Book Rehearsal Space");
    expect(activityDescription({ ...baseEvent, type: "QUESTION_ANSWERED" }))
      .toBe("Maya answered a question in Book Rehearsal Space");
    expect(activityDescription({ ...baseEvent, type: "MEMBER_PROMOTED", targetName: "Alex", targetRole: "Officer" }))
      .toBe("Maya made Alex an Officer");
    expect(activityDescription({ ...baseEvent, type: "OWNERSHIP_TRANSFERRED", targetName: "Alex", targetRole: "Owner" }))
      .toBe("Maya transferred ownership to Alex");
  });

  test("formats compact relative times from server timestamps", () => {
    const now = new Date("2026-10-18T17:00:00.000Z").getTime();
    expect(formatActivityRelativeTime(baseEvent.occurredAt, now)).toBe("18 minutes ago");
    expect(formatActivityRelativeTime("2026-10-18T16:59:45.000Z", now)).toBe("just now");
  });

  test("preserves stable Playbook identity for activity navigation", () => {
    expect(activityProcedureTarget(baseEvent)).toBe("procedure-1");
    expect(activityProcedureTarget({
      ...baseEvent,
      type: "CONTEXT_CREATED",
      procedure: undefined,
      procedureTitle: undefined,
    })).toBeUndefined();
  });
});
