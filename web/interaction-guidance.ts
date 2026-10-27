export function meaningfulChangeConsequence(affectedPlaybooks: number): string {
  if (!affectedPlaybooks) return "No active Playbooks use this note, so this will not create a Review.";
  return `This will preserve the before-and-after text and create or update ${affectedPlaybooks} ${affectedPlaybooks === 1 ? "Playbook Review" : "Playbook Reviews"}.`;
}

export function meaningfulChangeActionLabel(affectedPlaybooks: number): string {
  if (!affectedPlaybooks) return "Save changed information";
  return `Save change and review ${affectedPlaybooks} ${affectedPlaybooks === 1 ? "Playbook" : "Playbooks"}`;
}

export function reviewDecisionGuidance(status: string): string {
  return status === "PENDING"
    ? "Choose Still correct if the instructions already work with the new context. Choose Needs updating if the Playbook must change."
    : "Update the affected Steps or Context attachments here, or open the full Playbook editor. Resolve only when the instructions are current.";
}

export function questionActionLabel(questionCount: number): string {
  return questionCount ? `Questions (${questionCount})` : "Ask a question";
}

export const invitedRegistrationGuidance =
  "Invited to a club? Use the exact email address associated with your invitation.";

export const invitationAcceptanceGuidance =
  "You must be signed in with the exact email address associated with the invitation.";

export function sessionEndedMessage(hadUnsavedWork: boolean): string {
  return hadUnsavedWork
    ? "Your session expired, so Relay signed you out. Your unsaved text was cleared and cannot be recovered. Sign in again."
    : "Your session expired, so Relay signed you out. Sign in again.";
}
