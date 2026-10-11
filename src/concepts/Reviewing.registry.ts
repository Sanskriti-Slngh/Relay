import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Reviewing.md" with { type: "text" };
import {
  AddCauseReviewFinished,
  AddCauseReviewNotFound,
  CancelReviewFinished,
  CancelReviewNotFound,
  CauseAlreadyPresent,
  ConfirmReviewNotFound,
  RequestAlreadyUnfinished,
  RequireChangesReviewNotFound,
  ResolveReviewNotFound,
  ReviewNotAwaitingChanges,
  ReviewNotPendingForChanges,
  ReviewNotPendingForConfirmation,
  ReviewingConcept,
} from "./Reviewing.ts";

export const reviewing = registerConcept({
  class: ReviewingConcept,
  spec,
  refusals: {
    REQUEST_ALREADY_UNFINISHED: RequestAlreadyUnfinished,
    ADD_CAUSE_REVIEW_NOT_FOUND: AddCauseReviewNotFound,
    ADD_CAUSE_REVIEW_FINISHED: AddCauseReviewFinished,
    CAUSE_ALREADY_PRESENT: CauseAlreadyPresent,
    CONFIRM_REVIEW_NOT_FOUND: ConfirmReviewNotFound,
    REVIEW_NOT_PENDING_FOR_CONFIRMATION: ReviewNotPendingForConfirmation,
    REQUIRE_CHANGES_REVIEW_NOT_FOUND: RequireChangesReviewNotFound,
    REVIEW_NOT_PENDING_FOR_CHANGES: ReviewNotPendingForChanges,
    RESOLVE_REVIEW_NOT_FOUND: ResolveReviewNotFound,
    REVIEW_NOT_AWAITING_CHANGES: ReviewNotAwaitingChanges,
    CANCEL_REVIEW_NOT_FOUND: CancelReviewNotFound,
    CANCEL_REVIEW_FINISHED: CancelReviewFinished,
  },
});
