export type ReplaceContextResult =
  | { status: "REPLACED"; context: string }
  | { status: "RECORDED_ONLY"; context: string; cause: unknown }
  | { status: "BOTH_ATTACHED"; context: string; cause: unknown };

export async function replaceContextConnection({
  replacementContext,
  record,
  attach,
  detach,
}: {
  replacementContext?: string;
  record?: () => Promise<string>;
  attach: (context: string) => Promise<unknown>;
  detach: () => Promise<unknown>;
}): Promise<ReplaceContextResult> {
  const recorded = !replacementContext;
  const context = replacementContext ?? await record!();
  try {
    await attach(context);
  } catch (cause) {
    if (!recorded) throw cause;
    return { status: "RECORDED_ONLY", context, cause };
  }
  try {
    await detach();
  } catch (cause) {
    return { status: "BOTH_ATTACHED", context, cause };
  }
  return { status: "REPLACED", context };
}
