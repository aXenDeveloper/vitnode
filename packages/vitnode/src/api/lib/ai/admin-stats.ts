import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql,
  sum,
} from "drizzle-orm";

import type {
  AiCompareKind,
  AiDayRange,
  AiOverviewPreset,
} from "@/lib/ai/overview-range";

import {
  addAiDays,
  aiMonthOf,
  aiMonthRange,
  countAiDays,
  shiftAiMonth,
} from "@/lib/ai/overview-range";

import type { AiUsageDay, AiUsageTotals } from "./overview-math";
import type { AiDatabase } from "./postgres-ledger";

import { core_ai_budget_periods, core_ai_runs } from "../../../database/ai";
import { GLOBAL_SCOPE } from "./budget";
import {
  formatDecimal,
  formatDecimalOrNull,
  multiplyByInteger,
  parseDecimal,
} from "./decimal";
import {
  dailyAiRate,
  EMPTY_AI_USAGE,
  fillAiUsageDays,
  forecastAiSpend,
  sumAiUsage,
  toAiUsageTotals,
} from "./overview-math";
import { localDayStart } from "./periods";

const FAILED_STATUSES = ["failed", "uncertain", "canceled"] as const;
const DAY_MS = 86_400_000;

export interface AiUsageEntity {
  current: AiUsageTotals;
  key: string;
  previous: AiUsageTotals;
}

export interface AiBudgetDay {
  costUsd: string;
  day: string;
}

export interface AiOverview {
  budget: {
    dailyRateUsd: string;
    days: AiBudgetDay[];
    end: string;
    forecastUsd: null | string;
    limitUsd: null | string;
    live: boolean;
    month: string;
    monthlyAtRateUsd: string;
    previousDays: AiBudgetDay[];
    reservedUsd: string;
    spentUsd: string;
    start: string;
  };
  byAction: AiUsageEntity[];
  byModel: AiUsageEntity[];
  compare: AiDayRange & {
    days: AiUsageDay[];
    kind: AiCompareKind;
    totals: AiUsageTotals;
  };
  firstDay: null | string;
  range: AiDayRange & {
    days: AiUsageDay[];
    preset: AiOverviewPreset | null;
    totals: AiUsageTotals;
  };
  timeZone: string;
  today: string;
}

const aggregates = {
  chargedUsd: sum(core_ai_runs.chargedUsd),
  failures: sql<number>`count(*) filter (where ${inArray(core_ai_runs.status, [...FAILED_STATUSES])})`,
  inputTokens: sum(core_ai_runs.inputTokens),
  knownCostUsd: sum(core_ai_runs.costUsd),
  knownOperations: count(core_ai_runs.costUsd),
  operations: count(),
  outputTokens: sum(core_ai_runs.outputTokens),
};

const toBudgetDays = (days: AiUsageDay[]): AiBudgetDay[] =>
  days.map(day => ({ costUsd: day.chargedUsd, day: day.day }));

export const loadAiOverview = async (
  db: AiDatabase,
  {
    compare,
    limitUsd,
    month,
    now = new Date(),
    preset,
    range,
    timeZone,
    today,
  }: {
    compare: { kind: AiCompareKind; range: AiDayRange };
    limitUsd: bigint | null;
    month: string;
    now?: Date;
    preset: AiOverviewPreset | null;
    range: AiDayRange;
    timeZone: string;
    today: string;
  },
): Promise<AiOverview> => {
  const within = (window: AiDayRange) =>
    and(
      gte(core_ai_runs.createdAt, localDayStart(window.start, timeZone)),
      lt(
        core_ai_runs.createdAt,
        localDayStart(addAiDays(window.end, 1), timeZone),
      ),
      eq(core_ai_runs.settlement, "settled"),
    );

  const localDay = sql<string>`to_char((${core_ai_runs.createdAt} at time zone 'UTC') at time zone ${timeZone}, 'YYYY-MM-DD')`;

  const daily = async (window: AiDayRange) =>
    fillAiUsageDays(
      window,
      today,
      await db
        .select({ day: localDay, ...aggregates })
        .from(core_ai_runs)
        .where(within(window))
        .groupBy(sql`1`),
    );

  const entities = async (
    column: typeof core_ai_runs.actionKey | typeof core_ai_runs.modelId,
  ): Promise<AiUsageEntity[]> => {
    const read = async (window: AiDayRange) =>
      await db
        .select({ key: column, ...aggregates })
        .from(core_ai_runs)
        .where(and(within(window), isNotNull(column)))
        .groupBy(column);
    const [current, previous] = await Promise.all([
      read(range),
      read(compare.range),
    ]);
    const before = new Map(previous.map(row => [row.key, row]));
    const seen = new Set(current.map(row => row.key));

    return [
      ...current.map(row => ({
        current: toAiUsageTotals(row),
        key: row.key ?? "unknown",
        previous: toAiUsageTotals(before.get(row.key)),
      })),
      ...previous
        .filter(row => !seen.has(row.key))
        .map(row => ({
          current: EMPTY_AI_USAGE,
          key: row.key ?? "unknown",
          previous: toAiUsageTotals(row),
        })),
    ];
  };

  const monthRange = aiMonthRange(month);
  const previousMonthRange = aiMonthRange(shiftAiMonth(month, -1));

  const [
    rangeDays,
    compareDays,
    monthDays,
    previousMonthDays,
    byAction,
    byModel,
    [budgetRow],
    [first],
  ] = await Promise.all([
    daily(range),
    daily(compare.range),
    daily(monthRange),
    daily(previousMonthRange),
    entities(core_ai_runs.actionKey),
    entities(core_ai_runs.modelId),
    db
      .select()
      .from(core_ai_budget_periods)
      .where(
        and(
          eq(core_ai_budget_periods.scopeKey, GLOBAL_SCOPE),
          eq(
            core_ai_budget_periods.periodStart,
            localDayStart(monthRange.start, timeZone),
          ),
        ),
      ),
    db
      .select({ first: sql<null | string>`min(${localDay})` })
      .from(core_ai_runs)
      .where(eq(core_ai_runs.settlement, "settled")),
  ]);

  const live = month === aiMonthOf(today);
  const spent = parseDecimal(budgetRow?.spentAmount ?? "0");
  const rate = dailyAiRate(rangeDays, today);
  const monthEnd = localDayStart(addAiDays(monthRange.end, 1), timeZone);

  return {
    budget: {
      dailyRateUsd: formatDecimal(rate),
      days: toBudgetDays(monthDays),
      end: monthRange.end,
      forecastUsd: live
        ? formatDecimal(
            forecastAiSpend({
              rate,
              remainingDays: (monthEnd.getTime() - now.getTime()) / DAY_MS,
              spent,
            }),
          )
        : null,
      limitUsd: formatDecimalOrNull(limitUsd),
      live,
      month,
      monthlyAtRateUsd: formatDecimal(
        multiplyByInteger(rate, countAiDays(monthRange)),
      ),
      previousDays: toBudgetDays(previousMonthDays),
      reservedUsd: formatDecimal(
        parseDecimal(budgetRow?.reservedAmount ?? "0"),
      ),
      spentUsd: formatDecimal(spent),
      start: monthRange.start,
    },
    byAction,
    byModel,
    compare: {
      ...compare.range,
      days: compareDays,
      kind: compare.kind,
      totals: sumAiUsage(compareDays),
    },
    firstDay: first?.first ?? null,
    range: {
      ...range,
      days: rangeDays,
      preset,
      totals: sumAiUsage(rangeDays),
    },
    timeZone,
    today,
  };
};
