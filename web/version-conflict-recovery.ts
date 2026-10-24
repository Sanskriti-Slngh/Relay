import { RelayApiError } from "./api.ts";

export async function refreshAfterVersionConflict(
  error: unknown,
  releaseAction: () => void,
  refresh: () => Promise<unknown>,
): Promise<boolean> {
  if (!(error instanceof RelayApiError) || error.code !== "VERSION_CONFLICT") return false;
  releaseAction();
  await refresh();
  return true;
}
