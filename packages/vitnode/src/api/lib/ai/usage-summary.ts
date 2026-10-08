import type { Context } from "hono";

import { and, eq, gte, sql } from "drizzle-orm";

import type { AiLedger, AiUserPolicy } from "./ledger";

import { core_ai_budget_periods, core_ai_runs } from "../../../database/ai";
import { AI_USAGE_WARNING_SHARE } from "../../../lib/ai/usage-tone";
import { GLOBAL_SCOPE, userDailyScope, userScope } from "./budget";
import {
  formatDecimal,
  formatDecimalOrNull,
  maxDecimal,
  parseDecimal,
} from "./decimal";
import { periodContaining } from "./periods";

export interface AiUserActionUsage {
  dailyLimit: null | number;
  description: null | string;
  icon: null | string;
  key: string;
  monthPoints: string;
  permissionKey: string;
  title: string;
  usedToday: number;
}

export interface AiUserUsage {
  actions: AiUserActionUsage[];
  enabled: boolean;
  notice: "exhausted" | "near_limit" | "no_allowance" | "none" | "site_paused";
  points: {
    available: null | string;
    reserved: string;
    total: null | string;
    used: string;
  };
  resetsAt: string;
  sitePaused: boolean;
}

const readRow = async (
  db: Context["var"]["db"],
  scopeKey: string,
  periodStart: Date,
) => {
  const [row] = await db
    .select()
    .from(core_ai_budget_periods)
    .where(
      and(
        eq(core_ai_budget_periods.scopeKey, scopeKey),
        eq(core_ai_budget_periods.periodStart, periodStart),
      ),
    )
    .limit(1);

  return row;
};

export const loadUserAiUsage = async (
  c: Context,
  ledger: AiLedger,
  userId: number,
): Promise<AiUserUsage> => {
  const db = c.get("db");
  const settings = await ledger.loadSettings();
  const now = new Date();
  const month = periodContaining(now, "month", settings.timeZone);
  const day = periodContaining(now, "day", settings.timeZone);

  const userActions = c
    .get("ai")
    .actions()
    .all()
    .filter(action => action.definition.actors.includes("user"));

  const permissionDefaults = new Map<string, boolean>();
  for (const action of userActions) {
    if (!permissionDefaults.has(action.permissionKey)) {
      permissionDefaults.set(
        action.permissionKey,
        action.definition.permission.defaultGranted,
      );
    }
  }
  const policies = new Map<string, AiUserPolicy>(
    await Promise.all(
      [...permissionDefaults].map(
        async ([permissionKey, defaultGranted]) =>
          [
            permissionKey,
            await ledger.resolveUserPolicy({
              defaultGranted,
              permissionKey,
              userId,
            }),
          ] as const,
      ),
    ),
  );
  const allowance =
    [...policies.values()][0] ??
    (await ledger.resolveUserPolicy({
      defaultGranted: false,
      permissionKey: "",
      userId,
    }));

  const [own, global] = await Promise.all([
    readRow(db, userScope(userId), month.start),
    readRow(db, GLOBAL_SCOPE, month.start),
  ]);
  const used = parseDecimal(own?.spentAmount ?? "0");
  const reserved = parseDecimal(own?.reservedAmount ?? "0");
  const total = allowance.monthlyPoints;
  const available =
    total === null ? null : maxDecimal(total - used - reserved, 0n);

  const globalLimit = settings.monthlyBudgetUsd;
  const sitePaused =
    !settings.enabled ||
    (globalLimit !== null &&
      parseDecimal(global?.spentAmount ?? "0") +
        parseDecimal(global?.reservedAmount ?? "0") >=
        globalLimit);

  const monthPointsByAction = new Map(
    (
      await db
        .select({
          actionKey: core_ai_runs.actionKey,
          points: sql<string>`coalesce(sum(${core_ai_runs.chargedPoints}), 0)`,
        })
        .from(core_ai_runs)
        .where(
          and(
            eq(core_ai_runs.actorType, "user"),
            eq(core_ai_runs.userId, userId),
            gte(core_ai_runs.createdAt, month.start),
          ),
        )
        .groupBy(core_ai_runs.actionKey)
    ).map(row => [row.actionKey, formatDecimal(parseDecimal(row.points))]),
  );

  const grantedActions = userActions.flatMap(action => {
    const policy = policies.get(action.permissionKey);

    return policy?.granted ? [{ action, policy }] : [];
  });
  const actionUsages = await Promise.all(
    grantedActions.map(async ({ action, policy }) => {
      const [daily, actionSettings] = await Promise.all([
        readRow(db, userDailyScope(userId, action.permissionKey), day.start),
        ledger.loadActionSettings(action.key),
      ]);

      return { action, actionSettings, daily, policy };
    }),
  );
  const actions: AiUserActionUsage[] = [];
  for (const { action, actionSettings, daily, policy } of actionUsages) {
    if (actionSettings?.enabled === false) continue;
    actions.push({
      dailyLimit:
        policy.dailyLimit ??
        actionSettings?.dailyLimit ??
        action.definition.defaults.dailyLimit,
      description: action.definition.description,
      icon: action.definition.icon ?? null,
      key: action.key,
      monthPoints: monthPointsByAction.get(action.key) ?? "0",
      permissionKey: action.permissionKey,
      title: action.definition.title,
      usedToday: Number(parseDecimal(daily?.spentAmount ?? "0") / 10n ** 12n),
    });
  }

  let notice: AiUserUsage["notice"] = "none";
  if (sitePaused) notice = "site_paused";
  else if (total === 0n) notice = "no_allowance";
  else if (total !== null && available === 0n) notice = "exhausted";
  else if (
    total !== null &&
    total > 0n &&
    Number(used + reserved) >= Number(total) * AI_USAGE_WARNING_SHARE
  ) {
    notice = "near_limit";
  }

  return {
    actions,
    enabled: settings.enabled,
    notice,
    points: {
      available: formatDecimalOrNull(available),
      reserved: formatDecimal(reserved),
      total: formatDecimalOrNull(total),
      used: formatDecimal(used),
    },
    resetsAt: month.end.toISOString(),
    sitePaused,
  };
};
