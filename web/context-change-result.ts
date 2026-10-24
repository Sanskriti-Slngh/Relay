import type { PendingReview } from "./api.ts";

export interface AffectedPlaybookReview {
  procedure: string;
  review: string;
  title: string;
}

export interface ContextChangeResult {
  context: string;
  affectedPlaybooks: AffectedPlaybookReview[];
}

/**
 * A Context change is presented as affecting a Playbook only after the
 * refreshed Review projection contains the exact Change identity as a Cause.
 */
export function confirmedAffectedPlaybooks(
  change: string,
  reviews: PendingReview[],
): AffectedPlaybookReview[] {
  return reviews
    .filter((review) => review.causes.some((cause) => cause.cause === change))
    .map(({ procedure, review, title }) => ({ procedure, review, title }));
}

/** Keep a change result aligned with the unfinished Review projection. */
export function remainingAffectedPlaybooks(
  affectedPlaybooks: AffectedPlaybookReview[],
  reviews: PendingReview[],
): AffectedPlaybookReview[] {
  const unfinishedReviews = new Set(reviews.map(({ review }) => review));
  return affectedPlaybooks.filter(({ review }) => unfinishedReviews.has(review));
}
