export function hasMeaningfulDraft(values: Iterable<string | undefined>): boolean {
  return [...values].some((value) => !!value?.trim());
}

export function hasChangedDraft(saved: string, drafts: Iterable<string | undefined>): boolean {
  return [...drafts].some((draft) => draft !== undefined && draft !== saved);
}

export async function discardAfterSuccessfulAction<T>(action: () => Promise<T>, discard: () => void): Promise<T> {
  const result = await action();
  discard();
  return result;
}

export function shouldConfirmDiscard(hasUnsavedWork: boolean, leavesCurrentEditor: boolean): boolean {
  return hasUnsavedWork && leavesCurrentEditor;
}
