import type { Decimal } from "./decimal";
import type { AiErrorCode } from "./errors";
import type { AiReservationRequest } from "./ledger";
import type { AiPeriod } from "./periods";

import { decimalFromInteger } from "./decimal";
import { usdToPoints } from "./ledger";
import { periodContaining } from "./periods";

export type AiBudgetUnit = "count" | "points" | "usd";

export interface AiBudgetItem {
  amount: Decimal;
  exceededCode: AiErrorCode;
  limit: Decimal | null;
  period: AiPeriod;
  scopeKey: string;
  unit: AiBudgetUnit;
}

export interface AiBudgetRowState {
  limitAmount: Decimal | null;
  periodEnd: Date;
  reservedAmount: Decimal;
  scopeKey: string;
  spentAmount: Decimal;
}

export const GLOBAL_SCOPE = "global";
export const SYSTEM_SCOPE = "system";
export const userScope = (userId: number) => `user:${userId}`;
export const userDailyScope = (userId: number, permissionKey: string) =>
  `user:${userId}:daily:${permissionKey}`;

export const planBudgetItems = (
  request: Pick<
    AiReservationRequest,
    | "actorType"
    | "daily"
    | "globalMonthlyUsd"
    | "now"
    | "systemMonthlyUsd"
    | "timeZone"
    | "usd"
    | "userId"
    | "userMonthlyPoints"
  >,
): AiBudgetItem[] => {
  const month = periodContaining(request.now, "month", request.timeZone);
  const usd = request.usd ?? 0n;
  const items: AiBudgetItem[] = [
    {
      amount: usd,
      exceededCode: "AI_BUDGET_EXHAUSTED",
      limit: request.globalMonthlyUsd,
      period: month,
      scopeKey: GLOBAL_SCOPE,
      unit: "usd",
    },
  ];

  if (request.actorType === "system") {
    items.push({
      amount: usd,
      exceededCode: "AI_BUDGET_EXHAUSTED",
      limit: request.systemMonthlyUsd,
      period: month,
      scopeKey: SYSTEM_SCOPE,
      unit: "usd",
    });
  } else if (request.userId !== null) {
    items.push({
      amount: usdToPoints(usd),
      exceededCode: "AI_USER_LIMIT_REACHED",
      limit: request.userMonthlyPoints,
      period: month,
      scopeKey: userScope(request.userId),
      unit: "points",
    });
    if (request.daily) {
      items.push({
        amount: decimalFromInteger(1),
        exceededCode: "AI_DAILY_LIMIT_REACHED",
        limit:
          request.daily.limit === null
            ? null
            : decimalFromInteger(request.daily.limit),
        period: periodContaining(request.now, "day", request.timeZone),
        scopeKey: userDailyScope(request.userId, request.daily.permissionKey),
        unit: "count",
      });
    }
  }

  return items.sort((a, b) => (a.scopeKey < b.scopeKey ? -1 : 1));
};

export const findExceededBudget = (
  items: AiBudgetItem[],
  rows: Map<string, AiBudgetRowState>,
  { priced }: { priced: boolean },
): null | { code: AiErrorCode; resetsAt: Date } => {
  for (const item of items) {
    if (item.limit === null) continue;
    if (!priced && item.unit !== "count") {
      return { code: "AI_PRICING_MISSING", resetsAt: item.period.end };
    }
    const row = rows.get(item.scopeKey);
    const used = (row?.spentAmount ?? 0n) + (row?.reservedAmount ?? 0n);
    if (used + item.amount > item.limit) {
      return { code: item.exceededCode, resetsAt: item.period.end };
    }
  }

  return null;
};

export const deliveredCostUsd = (
  calls: { costUsd: Decimal | null; status: string }[],
  reservedUsd: Decimal,
): Decimal => {
  const succeeded = calls.filter(call => call.status === "succeeded");
  if (succeeded.some(call => call.costUsd === null)) return reservedUsd;

  return succeeded.reduce((total, call) => total + (call.costUsd ?? 0n), 0n);
};

export const settlementCharge = ({
  chargedUsd,
  delivered,
  deliveredUsd,
  unit,
}: {
  chargedUsd: Decimal;
  delivered: boolean;
  deliveredUsd: Decimal;
  unit: AiBudgetUnit;
}): Decimal => {
  if (unit === "usd") return chargedUsd;
  if (!delivered) return 0n;
  if (unit === "points") return usdToPoints(deliveredUsd);

  return decimalFromInteger(1);
};
