import type { AiUsageDay, AiUsageTotals } from "../ai-query";

export const AI_OVERVIEW_METRICS = [
  "spend",
  "per_run",
  "runs",
  "failure_rate",
  "tokens",
  "known",
] as const;

export type AiOverviewMetric = (typeof AI_OVERVIEW_METRICS)[number];

export type AiBreakdownMeasure = "cost" | "failures" | "ops" | "tokens";

export type AiMetricFormat = "count" | "percent" | "tokens" | "usd";

export type AiDeltaTone = "down-good" | "neutral" | "up-good";

export const AI_METRIC_SPEC: Record<
  AiOverviewMetric,
  {
    format: AiMetricFormat;
    measure: AiBreakdownMeasure;
    ratio: boolean;
    tone: AiDeltaTone;
  }
> = {
  failure_rate: {
    format: "percent",
    measure: "failures",
    ratio: true,
    tone: "down-good",
  },
  known: { format: "percent", measure: "cost", ratio: true, tone: "up-good" },
  per_run: { format: "usd", measure: "cost", ratio: true, tone: "down-good" },
  runs: { format: "count", measure: "ops", ratio: false, tone: "neutral" },
  spend: { format: "usd", measure: "cost", ratio: false, tone: "down-good" },
  tokens: {
    format: "tokens",
    measure: "tokens",
    ratio: false,
    tone: "neutral",
  },
};

export const usdNumber = (value: string): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const metricValue = (
  metric: AiOverviewMetric,
  totals: AiUsageTotals,
): number => {
  switch (metric) {
    case "failure_rate":
      return totals.operations === 0 ? 0 : totals.failures / totals.operations;
    case "known":
      return totals.operations === 0
        ? 1
        : totals.knownOperations / totals.operations;
    case "per_run":
      return totals.knownOperations === 0
        ? 0
        : usdNumber(totals.knownCostUsd) / totals.knownOperations;
    case "runs":
      return totals.operations;
    case "spend":
      return usdNumber(totals.knownCostUsd);
    case "tokens":
      return totals.inputTokens + totals.outputTokens;
  }
};

export const measureValue = (
  measure: AiBreakdownMeasure,
  totals: AiUsageTotals,
): number => {
  switch (measure) {
    case "cost":
      return usdNumber(totals.knownCostUsd);
    case "failures":
      return totals.failures;
    case "ops":
      return totals.operations;
    case "tokens":
      return totals.inputTokens + totals.outputTokens;
  }
};

const addTotals = (a: AiUsageTotals, b: AiUsageTotals): AiUsageTotals => ({
  chargedUsd: String(usdNumber(a.chargedUsd) + usdNumber(b.chargedUsd)),
  failures: a.failures + b.failures,
  inputTokens: a.inputTokens + b.inputTokens,
  knownCostUsd: String(usdNumber(a.knownCostUsd) + usdNumber(b.knownCostUsd)),
  knownOperations: a.knownOperations + b.knownOperations,
  operations: a.operations + b.operations,
  outputTokens: a.outputTokens + b.outputTokens,
});

const EMPTY: AiUsageTotals = {
  chargedUsd: "0",
  failures: 0,
  inputTokens: 0,
  knownCostUsd: "0",
  knownOperations: 0,
  operations: 0,
  outputTokens: 0,
};

export interface AiRunningPoint {
  day: string;
  previous: null | number;
  previousDay: null | string;
  value: number;
}

export const runningSeries = (
  metric: AiOverviewMetric,
  days: AiUsageDay[],
  previousDays: AiUsageDay[],
): AiRunningPoint[] => {
  let current = EMPTY;
  let previous = EMPTY;

  return days.map((day, index) => {
    current = addTotals(current, day);
    const before = previousDays.at(index);
    if (before) previous = addTotals(previous, before);

    return {
      day: day.day,
      previous:
        index < previousDays.length ? metricValue(metric, previous) : null,
      previousDay: before?.day ?? null,
      value: metricValue(metric, current),
    };
  });
};

export const cumulativeCost = (
  days: { costUsd: string; day: string }[],
): { day: string; value: number }[] => {
  let total = 0;

  return days.map(day => {
    total += usdNumber(day.costUsd);

    return { day: day.day, value: total };
  });
};

export const dayAsDate = (day: string): Date => new Date(`${day}T00:00:00Z`);
