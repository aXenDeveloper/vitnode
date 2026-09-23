export type TablePageSlot = "ellipsis" | number;

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(to - from + 1, 0) }, (_, step) => from + step);

export const tablePageWindow = ({
  current,
  siblings = 1,
  total,
}: {
  current: number;
  siblings?: number;
  total: number;
}): TablePageSlot[] => {
  if (total <= 0) return [];

  const page = Math.min(Math.max(Math.trunc(current), 1), total);
  const spread = Math.max(Math.trunc(siblings), 0);
  const withoutEllipsis = spread * 2 + 5;

  if (total <= withoutEllipsis) return range(1, total);

  const first = Math.max(page - spread, 1);
  const last = Math.min(page + spread, total);
  const hasLeadingGap = first > 2;
  const hasTrailingGap = last < total - 1;

  if (!hasLeadingGap && hasTrailingGap) {
    return [...range(1, spread * 2 + 3), "ellipsis", total];
  }

  if (hasLeadingGap && !hasTrailingGap) {
    return [1, "ellipsis", ...range(total - (spread * 2 + 2), total)];
  }

  return [1, "ellipsis", ...range(first, last), "ellipsis", total];
};
