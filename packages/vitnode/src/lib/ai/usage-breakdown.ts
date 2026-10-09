export const AI_USAGE_BREAKDOWN_SIZE = 3;

export type AiUsageSegment<TAction> =
  | { action: TAction; kind: "action"; points: number; share: number }
  | { count: number; kind: "other"; points: number; share: number };

export const aiUsageBreakdown = <TAction extends { monthPoints: string }>(
  actions: readonly TAction[],
): AiUsageSegment<TAction>[] => {
  const used = actions
    .map(action => ({ action, points: Number(action.monthPoints) }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points);
  const total = used.reduce((sum, { points }) => sum + points, 0);
  const named =
    used.length > AI_USAGE_BREAKDOWN_SIZE + 1
      ? used.slice(0, AI_USAGE_BREAKDOWN_SIZE)
      : used;
  const others = used.slice(named.length);
  const othersPoints = others.reduce((sum, { points }) => sum + points, 0);

  return [
    ...named.map(({ action, points }): AiUsageSegment<TAction> => ({
      action,
      kind: "action",
      points,
      share: points / total,
    })),
    ...(others.length > 0
      ? [
          {
            count: others.length,
            kind: "other" as const,
            points: othersPoints,
            share: othersPoints / total,
          },
        ]
      : []),
  ];
};
