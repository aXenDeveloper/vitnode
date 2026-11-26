import type { Context } from "hono";

import { and, eq, gte, sql } from "drizzle-orm";

import { core_ai_runs } from "../../database/ai";
import { formatDecimal, parseDecimal } from "../ai/decimal";
import { periodContaining } from "../ai/periods";
import { CONTENT_TRANSLATE_AI_ACTION } from "./action";

/**
 * USD spent on automatic translation in the current budget month, counting
 * runs still in flight at their reservation - so retries, timeouts and calls
 * that may have been billed all count against the same cap. Server-only.
 */
export const contentTranslationSpendUsd = async (
  c: Context,
): Promise<{ periodEnd: Date; spentUsd: string }> => {
  const settings = await c.get("ai").ledger().loadSettings();
  const period = periodContaining(new Date(), "month", settings.timeZone);
  const [row] = await c
    .get("db")
    .select({
      total: sql<null | string>`sum(
        CASE WHEN ${core_ai_runs.settlement} = 'pending'
          THEN ${core_ai_runs.reservedUsd}
          ELSE coalesce(${core_ai_runs.chargedUsd}, ${core_ai_runs.costUsd}, ${core_ai_runs.reservedUsd})
        END
      )`,
    })
    .from(core_ai_runs)
    .where(
      and(
        eq(core_ai_runs.actionKey, CONTENT_TRANSLATE_AI_ACTION),
        gte(core_ai_runs.createdAt, period.start),
      ),
    );

  return {
    periodEnd: period.end,
    spentUsd: formatDecimal(parseDecimal(row?.total ?? "0")),
  };
};

/**
 * Whether `extraUsd` more still fits the dedicated monthly cap. A `null` cap
 * leaves only the site and background-job AI budgets in charge.
 */
export const fitsContentTranslationBudget = (
  capUsd: null | string,
  spentUsd: string,
  extraUsd = "0",
): boolean =>
  capUsd === null ||
  parseDecimal(spentUsd) + parseDecimal(extraUsd) <= parseDecimal(capUsd);
