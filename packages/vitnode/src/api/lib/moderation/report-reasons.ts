import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, asc, eq, inArray } from "drizzle-orm";

import { core_languages_words } from "@/database/languages";
import { core_moderation_report_reasons } from "@/database/moderation";

export const REPORT_REASON_WORDS = {
  pluginCode: "core",
  tableName: "core_moderation_report_reasons",
} as const;

export type ReportReasonWordVariable = "description" | "title";

const multiLangSchema = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

export const reportReasonSchema = z.object({
  id: z.number(),
  code: z.string(),
  requiresDetails: z.boolean(),
  position: z.number(),
  title: multiLangSchema,
  description: multiLangSchema,
});

export type ReportReason = z.infer<typeof reportReasonSchema>;

const wordsFor = async (c: Context, ids: number[]) => {
  if (ids.length === 0) return [];

  return await c
    .get("db")
    .select({
      itemId: core_languages_words.itemId,
      languageCode: core_languages_words.languageCode,
      value: core_languages_words.value,
      variable: core_languages_words.variable,
    })
    .from(core_languages_words)
    .where(
      and(
        eq(core_languages_words.pluginCode, REPORT_REASON_WORDS.pluginCode),
        eq(core_languages_words.tableName, REPORT_REASON_WORDS.tableName),
        inArray(core_languages_words.itemId, ids),
      ),
    );
};

export const listReportReasons = async (
  c: Context,
): Promise<ReportReason[]> => {
  const rows = await c
    .get("db")
    .select({
      code: core_moderation_report_reasons.code,
      id: core_moderation_report_reasons.id,
      position: core_moderation_report_reasons.position,
      requiresDetails: core_moderation_report_reasons.requiresDetails,
    })
    .from(core_moderation_report_reasons)
    .orderBy(
      asc(core_moderation_report_reasons.position),
      asc(core_moderation_report_reasons.id),
    );
  const words = await wordsFor(
    c,
    rows.map(row => row.id),
  );
  const pick = (id: number, variable: ReportReasonWordVariable) =>
    words
      .filter(word => word.itemId === id && word.variable === variable)
      .map(word => ({ languageCode: word.languageCode, value: word.value }));

  return rows.map(row => ({
    ...row,
    description: pick(row.id, "description"),
    title: pick(row.id, "title"),
  }));
};
