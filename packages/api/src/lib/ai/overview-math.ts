import type { AiDayRange } from "@/lib/ai/overview-range";

import { listAiDays } from "@/lib/ai/overview-range";

import type { Decimal } from "./decimal";

import {
  decimalFromNumber,
  divideByInteger,
  formatDecimal,
  multiplyDecimal,
  parseDecimal,
} from "./decimal";

export interface AiUsageTotals {
  chargedUsd: string;
  failures: number;
  inputTokens: number;
  knownCostUsd: string;
  knownOperations: number;
  operations: number;
  outputTokens: number;
}

export interface AiUsageDay extends AiUsageTotals {
  day: string;
}

export interface AiUsageRow {
  chargedUsd: null | string;
  failures: null | number | string;
  inputTokens: null | number | string;
  knownCostUsd: null | string;
  knownOperations: null | number | string;
  operations: null | number | string;
  outputTokens: null | number | string;
}

const toNumber = (value: null | number | string | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

export const EMPTY_AI_USAGE: AiUsageTotals = {
  chargedUsd: "0",
  failures: 0,
  inputTokens: 0,
  knownCostUsd: "0",
  knownOperations: 0,
  operations: 0,
  outputTokens: 0,
};

export const toAiUsageTotals = (row: AiUsageRow | undefined): AiUsageTotals =>
  row
    ? {
        chargedUsd: formatDecimal(parseDecimal(row.chargedUsd ?? "0")),
        failures: toNumber(row.failures),
        inputTokens: toNumber(row.inputTokens),
        knownCostUsd: formatDecimal(parseDecimal(row.knownCostUsd ?? "0")),
        knownOperations: toNumber(row.knownOperations),
        operations: toNumber(row.operations),
        outputTokens: toNumber(row.outputTokens),
      }
    : EMPTY_AI_USAGE;

export const sumAiUsage = (rows: AiUsageTotals[]): AiUsageTotals => {
  let cost = 0n;
  let charged = 0n;
  const total = { ...EMPTY_AI_USAGE };
  for (const row of rows) {
    cost += parseDecimal(row.knownCostUsd);
    charged += parseDecimal(row.chargedUsd);
    total.failures += row.failures;
    total.inputTokens += row.inputTokens;
    total.knownOperations += row.knownOperations;
    total.operations += row.operations;
    total.outputTokens += row.outputTokens;
  }

  return {
    ...total,
    chargedUsd: formatDecimal(charged),
    knownCostUsd: formatDecimal(cost),
  };
};

export const fillAiUsageDays = (
  range: AiDayRange,
  today: string,
  rows: (AiUsageRow & { day: string })[],
): AiUsageDay[] => {
  const byDay = new Map(rows.map(row => [row.day, row]));
  const end = range.end > today ? today : range.end;
  if (end < range.start) return [];

  return listAiDays({ end, start: range.start }).map(day => ({
    ...toAiUsageTotals(byDay.get(day)),
    day,
  }));
};

export const dailyAiRate = (days: AiUsageDay[], today: string): Decimal => {
  const complete = days.filter(day => day.day < today);
  const counted = complete.length > 0 ? complete : days;
  if (counted.length === 0) return 0n;

  return divideByInteger(
    counted.reduce((sum, day) => sum + parseDecimal(day.chargedUsd), 0n),
    counted.length,
  );
};

export const forecastAiSpend = ({
  rate,
  remainingDays,
  spent,
}: {
  rate: Decimal;
  remainingDays: number;
  spent: Decimal;
}): Decimal =>
  spent + multiplyDecimal(rate, decimalFromNumber(Math.max(remainingDays, 0)));
