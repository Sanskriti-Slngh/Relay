export type InlineContextSaveResult =
  | { status: "ATTACHED"; context: string }
  | { status: "RECORDED_ONLY"; context: string; cause: unknown };

export async function recordAndAttachInlineContext(
  record: () => Promise<{ context: string }>,
  attach: (context: string) => Promise<unknown>,
): Promise<InlineContextSaveResult> {
  const { context } = await record();
  try {
    await attach(context);
    return { status: "ATTACHED", context };
  } catch (cause) {
    return { status: "RECORDED_ONLY", context, cause };
  }
}
