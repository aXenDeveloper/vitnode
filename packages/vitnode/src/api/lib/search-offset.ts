export const MAX_SEARCH_OFFSET = 10_000;

export const parseSearchOffset = (
  cursor: string | undefined,
  max: number = MAX_SEARCH_OFFSET,
): number | undefined => {
  if (!cursor) return undefined;

  const parsed = Number(cursor);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined;

  return Math.min(parsed, Math.max(0, max));
};
