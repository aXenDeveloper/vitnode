import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";
import type { ModerationAuditType } from "@/lib/moderation/warnings";

import { core_languages_words } from "@/database/languages";
import {
  core_moderation_audit,
  core_moderation_warning_reasons,
} from "@/database/warnings";

export const WARNING_REASON_WORDS = {
  pluginCode: "core",
  tableName: "core_moderation_warning_reasons",
} as const;

export type WarningReasonWordVariable = "description" | "message" | "title";

const multiLangSchema = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

export const warningReasonSchema = z.object({
  id: z.number(),
  points: z.number(),
  expiresAfterHours: z.number().nullable(),
  enabled: z.boolean(),
  position: z.number(),
  title: multiLangSchema,
  description: multiLangSchema,
  message: multiLangSchema,
});

export type WarningReason = z.infer<typeof warningReasonSchema>;

/** Every warning reason in display order, with its words; `enabledOnly` for new warnings. */
export const listWarningReasons = async (
  c: Context,
  { enabledOnly = false, ids }: { enabledOnly?: boolean; ids?: number[] } = {},
): Promise<WarningReason[]> => {
  const table = core_moderation_warning_reasons;
  const rows = await c
    .get("db")
    .select({
      enabled: table.enabled,
      expiresAfterHours: table.expiresAfterHours,
      id: table.id,
      points: table.points,
      position: table.position,
    })
    .from(table)
    .where(
      and(
        enabledOnly ? eq(table.enabled, true) : undefined,
        ids ? inArray(table.id, ids.length > 0 ? ids : [0]) : undefined,
      ),
    )
    .orderBy(asc(table.position), asc(table.id));
  if (rows.length === 0) return [];

  const words = await c
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
        eq(core_languages_words.pluginCode, WARNING_REASON_WORDS.pluginCode),
        eq(core_languages_words.tableName, WARNING_REASON_WORDS.tableName),
        inArray(
          core_languages_words.itemId,
          rows.map(row => row.id),
        ),
      ),
    );
  const pick = (id: number, variable: WarningReasonWordVariable) =>
    words
      .filter(word => word.itemId === id && word.variable === variable)
      .map(word => ({ languageCode: word.languageCode, value: word.value }));

  return rows.map(row => ({
    ...row,
    description: pick(row.id, "description"),
    message: pick(row.id, "message"),
    title: pick(row.id, "title"),
  }));
};

/**
 * Appends one entry to the warning system's audit trail. Never pass staff
 * notes or override explanations in `data`.
 */
export const appendModerationAudit = async (
  db: ContentDatabase,
  entry: {
    actorId: null | number;
    data?: Record<string, unknown>;
    sanctionId?: null | number;
    type: ModerationAuditType;
    userId?: null | number;
    warningId?: null | number;
  },
): Promise<void> => {
  await db.insert(core_moderation_audit).values({
    actorId: entry.actorId,
    data: entry.data ?? {},
    sanctionId: entry.sanctionId ?? null,
    type: entry.type,
    userId: entry.userId ?? null,
    warningId: entry.warningId ?? null,
  });
};
