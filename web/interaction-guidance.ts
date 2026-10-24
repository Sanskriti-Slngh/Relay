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
    : "First edit the Playbook. When its instructions match the changed context, return here and resolve the Review.";
}

export function questionActionLabel(questionCount: number): string {
  return questionCount ? `Questions (${questionCount})` : "Ask a question";
}
