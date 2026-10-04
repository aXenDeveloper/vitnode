import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { AiLedger } from "./ledger";

import { core_ai_budget_periods } from "../../../database/ai";
import { GLOBAL_SCOPE, userDailyScope, userScope } from "./budget";
import { formatDecimal, formatDecimalOrNull, parseDecimal } from "./decimal";
import { periodContaining } from "./periods";

/** Notice thresholds shown to users. */
export const AI_USAGE_WARNING_RATIO = 0.8;

export interface AiUserActionUsage {
  dailyLimit: null | number;
  description: null | string;
  key: string;
  permissionKey: string;
  usedToday: number;
}

export interface AiUserUsage {
  actions: AiUserActionUsage[];
  /** `false` when an admin switched AI off for everyone. */
  enabled: boolean;
  notice: "exhausted" | "near_limit" | "no_allowance" | "none" | "site_paused";
  points: {
    available: null | string;
    reserved: string;
    /** `null` is unlimited. */
    total: null | string;
    used: string;
  };
  resetsAt: string;
  /** The site budget, not the user's own limit, is what stops them. */
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

/**
 * One user's own AI allowance. Always scoped by the session's user id - no
 * parameter can point it at somebody else.
 */
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

  const policies = new Map<
    string,
    Awaited<ReturnType<AiLedger["resolveUserPolicy"]>>
  >();
  for (const action of userActions) {
    if (policies.has(action.permissionKey)) continue;
    policies.set(
      action.permissionKey,
      await ledger.resolveUserPolicy({
        defaultGranted: action.definition.permission.defaultGranted,
        permissionKey: action.permissionKey,
        userId,
      }),
    );
  }
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
    total === null
      ? null
      : total - used - reserved > 0n
        ? total - used - reserved
        : 0n;

  const globalLimit = settings.monthlyBudgetUsd;
  const sitePaused =
    !settings.enabled ||
    (globalLimit !== null &&
      parseDecimal(global?.spentAmount ?? "0") +
        parseDecimal(global?.reservedAmount ?? "0") >=
        globalLimit);

  const actions: AiUserActionUsage[] = [];
  for (const action of userActions) {
    const policy = policies.get(action.permissionKey);
    if (!policy?.granted) continue;
    const daily = await readRow(
      db,
      userDailyScope(userId, action.permissionKey),
      day.start,
    );
    const actionSettings = await ledger.loadActionSettings(action.key);
    if (actionSettings?.enabled === false) continue;
    actions.push({
      // The same order the runner enforces: role grant, admin setting, default.
      dailyLimit:
        policy.dailyLimit ??
        actionSettings?.dailyLimit ??
        action.definition.defaults.dailyLimit,
      description: action.definition.description ?? null,
      key: action.key,
      permissionKey: action.permissionKey,
      usedToday: Number(parseDecimal(daily?.spentAmount ?? "0") / 10n ** 12n),
    });
  }

  let notice: AiUserUsage["notice"] = "none";
  if (sitePaused) notice = "site_paused";
  // Never had points this period: not "used up" - there was nothing to use.
  else if (total === 0n) notice = "no_allowance";
  else if (total !== null && available === 0n) notice = "exhausted";
  else if (
    total !== null &&
    total > 0n &&
    Number(used + reserved) >= Number(total) * AI_USAGE_WARNING_RATIO
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
