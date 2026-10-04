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

import type { AiDatabase } from "./postgres-ledger";

import { core_ai_budget_periods, core_ai_runs } from "../../../database/ai";
import { GLOBAL_SCOPE, SYSTEM_SCOPE } from "./budget";
import {
  divideByInteger,
  formatDecimal,
  formatDecimalOrNull,
  parseDecimal,
} from "./decimal";

const FAILED_STATUSES = ["failed", "uncertain", "canceled"] as const;

export interface AiBreakdownRow {
  failures: number;
  key: string;
  knownCostUsd: string;
  knownOperations: number;
  operations: number;
}

export interface AiOverview {
  averageDailyCostUsd: string;
  /** Average of operations whose cost is known - unknown never counts as zero. */
  averageOperationCostUsd: null | string;
  budget: {
    limitUsd: null | string;
    remainingUsd: null | string;
    reservedUsd: string;
    spentUsd: string;
    systemLimitUsd: null | string;
    systemSpentUsd: string;
  };
  byAction: AiBreakdownRow[];
  byModel: AiBreakdownRow[];
  byOrigin: AiBreakdownRow[];
  costSources: { estimated: number; provider: number; unknown: number };
  failureRate: number;
  knownCostUsd: string;
  operations: number;
  period: { end: string; start: string };
  /** Share of operations with a known cost, 0..1. */
  pricingCoverage: number;
  tokens: { input: number; output: number };
}

const toNumber = (value: null | number | string | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

const breakdown = async (
  db: AiDatabase,
  column:
    | typeof core_ai_runs.actionKey
    | typeof core_ai_runs.actorType
    | typeof core_ai_runs.modelId,
  where: ReturnType<typeof and>,
): Promise<AiBreakdownRow[]> => {
  const rows = await db
    .select({
      failures: sql<number>`count(*) filter (where ${inArray(core_ai_runs.status, [...FAILED_STATUSES])})`,
      key: column,
      knownCostUsd: sum(core_ai_runs.costUsd),
      knownOperations: count(core_ai_runs.costUsd),
      operations: count(),
    })
    .from(core_ai_runs)
    .where(where)
    .groupBy(column)
    .orderBy(sql`count(*) desc`);

  return rows.map(row => ({
    failures: toNumber(row.failures),
    key: row.key ?? "unknown",
    knownCostUsd: formatDecimal(parseDecimal(row.knownCostUsd ?? "0")),
    knownOperations: toNumber(row.knownOperations),
    operations: toNumber(row.operations),
  }));
};

export const loadAiOverview = async (
  db: AiDatabase,
  {
    globalLimitUsd,
    now = new Date(),
    period,
    systemLimitUsd,
  }: {
    globalLimitUsd: bigint | null;
    now?: Date;
    period: { end: Date; start: Date };
    systemLimitUsd: bigint | null;
  },
): Promise<AiOverview> => {
  const where = and(
    gte(core_ai_runs.createdAt, period.start),
    lt(core_ai_runs.createdAt, period.end),
    eq(core_ai_runs.settlement, "settled"),
  );

  const [[totals], sources, byAction, byModel, byOrigin, budgets] =
    await Promise.all([
      db
        .select({
          failures: sql<number>`count(*) filter (where ${inArray(core_ai_runs.status, [...FAILED_STATUSES])})`,
          inputTokens: sum(core_ai_runs.inputTokens),
          knownCostUsd: sum(core_ai_runs.costUsd),
          knownOperations: count(core_ai_runs.costUsd),
          operations: count(),
          outputTokens: sum(core_ai_runs.outputTokens),
        })
        .from(core_ai_runs)
        .where(where),
      db
        .select({ source: core_ai_runs.costSource, total: count() })
        .from(core_ai_runs)
        .where(where)
        .groupBy(core_ai_runs.costSource),
      breakdown(db, core_ai_runs.actionKey, where),
      breakdown(
        db,
        core_ai_runs.modelId,
        and(where, isNotNull(core_ai_runs.modelId)),
      ),
      breakdown(db, core_ai_runs.actorType, where),
      db
        .select()
        .from(core_ai_budget_periods)
        .where(
          and(
            inArray(core_ai_budget_periods.scopeKey, [
              GLOBAL_SCOPE,
              SYSTEM_SCOPE,
            ]),
            eq(core_ai_budget_periods.periodStart, period.start),
          ),
        ),
    ]);

  const global = budgets.find(row => row.scopeKey === GLOBAL_SCOPE);
  const system = budgets.find(row => row.scopeKey === SYSTEM_SCOPE);
  const spent = parseDecimal(global?.spentAmount ?? "0");
  const reserved = parseDecimal(global?.reservedAmount ?? "0");
  const knownCost = parseDecimal(totals.knownCostUsd ?? "0");
  const operations = toNumber(totals.operations);
  const knownOperations = toNumber(totals.knownOperations);
  const elapsedMs =
    Math.min(now.getTime(), period.end.getTime()) - period.start.getTime();
  const elapsedDays = Math.max(1, Math.ceil(elapsedMs / 86_400_000));
  const sourceCount = (names: string[]) =>
    sources
      .filter(row => row.source !== null && names.includes(row.source))
      .reduce((total, row) => total + toNumber(row.total), 0);

  return {
    averageDailyCostUsd: formatDecimal(divideByInteger(spent, elapsedDays)),
    averageOperationCostUsd:
      knownOperations === 0
        ? null
        : formatDecimal(divideByInteger(knownCost, knownOperations)),
    budget: {
      limitUsd: formatDecimalOrNull(globalLimitUsd),
      remainingUsd:
        globalLimitUsd === null
          ? null
          : formatDecimal(
              globalLimitUsd - spent - reserved > 0n
                ? globalLimitUsd - spent - reserved
                : 0n,
            ),
      reservedUsd: formatDecimal(reserved),
      spentUsd: formatDecimal(spent),
      systemLimitUsd: formatDecimalOrNull(systemLimitUsd),
      systemSpentUsd: formatDecimal(parseDecimal(system?.spentAmount ?? "0")),
    },
    byAction,
    byModel,
    byOrigin,
    costSources: {
      estimated: sourceCount(["pricing", "manual", "mixed"]),
      provider: sourceCount(["provider"]),
      unknown: sourceCount(["unknown"]),
    },
    failureRate: operations === 0 ? 0 : toNumber(totals.failures) / operations,
    knownCostUsd: formatDecimal(knownCost),
    operations,
    period: {
      end: period.end.toISOString(),
      start: period.start.toISOString(),
    },
    pricingCoverage: operations === 0 ? 1 : knownOperations / operations,
    tokens: {
      input: toNumber(totals.inputTokens),
      output: toNumber(totals.outputTokens),
    },
  };
};
