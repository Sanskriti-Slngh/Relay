export function balancedAttentionItems<T, U>(
  primary: readonly T[],
  secondary: readonly U[],
  limit: number,
): (T | U)[] {
  const result: (T | U)[] = [];
  let primaryIndex = 0;
  let secondaryIndex = 0;
  while (result.length < limit && (primaryIndex < primary.length || secondaryIndex < secondary.length)) {
    if (primaryIndex < primary.length && result.length < limit) result.push(primary[primaryIndex++]);
    if (secondaryIndex < secondary.length && result.length < limit) result.push(secondary[secondaryIndex++]);
  }
  return result;
}
