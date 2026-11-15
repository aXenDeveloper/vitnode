import type { Context } from "hono";

import { eq, sql } from "drizzle-orm";

import { core_moderation_report_reasons } from "@/database/moderation";

export const LOCK_REASONS = sql`lock table ${core_moderation_report_reasons} in share row exclusive mode`;

export const findReasonRow = async (c: Context, id: number) => {
  const [row] = await c
    .get("db")
    .select({
      code: core_moderation_report_reasons.code,
      id: core_moderation_report_reasons.id,
      requiresDetails: core_moderation_report_reasons.requiresDetails,
    })
    .from(core_moderation_report_reasons)
    .where(eq(core_moderation_report_reasons.id, id))
    .limit(1);

  return row;
};
