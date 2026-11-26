import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, eq, gt, inArray, isNull, lt, notInArray } from "drizzle-orm";

import { autoTranslateFingerprint } from "../../content/auto-translate/source-hash";
import { contentIdKey, parseContentIdOf } from "../../content/ids";
import { listContentLanguages } from "../../content/server/language-resolver";
import { contentDefinitionOf } from "../../content/server/model";
import {
  core_content_ai_translation_jobs,
  core_content_ai_translations,
  core_content_translation_settings,
} from "../../database/content-translations";
import { readContentTranslationSettings } from "./settings";
import { autoTranslateModel } from "./targets";

const SWEEP_WINDOW = 500;
const DAY_MS = 24 * 3_600_000;
const JOB_RETENTION_DAYS = 30;

/**
 * One cleanup pass, bounded so an hourly cron never holds a long lock:
 *
 * - walks a window of current translations and marks the ones whose record
 *   now shows a different source as superseded;
 * - deletes translations and jobs of records that were permanently deleted
 *   (hidden or unpublished records keep theirs: every read checks the public
 *   rules anyway, and the record may come back);
 * - deletes superseded translations older than the retention window, and
 *   finished jobs older than 30 days.
 *
 * Current translations never expire on a timer. Server-only.
 */
export const cleanupContentTranslations = async (
  c: Context,
): Promise<{ deleted: number; superseded: number }> => {
  const db = c.get("db");
  const [settings, [state]] = await Promise.all([
    readContentTranslationSettings(db),
    db
      .select({ cursor: core_content_translation_settings.cleanupCursor })
      .from(core_content_translation_settings)
      .where(eq(core_content_translation_settings.id, 1)),
  ]);
  const cursor = state?.cursor ?? 0;

  const rows = await db
    .select({
      contentTypeId: core_content_ai_translations.contentTypeId,
      field: core_content_ai_translations.field,
      id: core_content_ai_translations.id,
      recordId: core_content_ai_translations.recordId,
      sourceFingerprint: core_content_ai_translations.sourceFingerprint,
    })
    .from(core_content_ai_translations)
    .where(
      and(
        gt(core_content_ai_translations.id, cursor),
        isNull(core_content_ai_translations.supersededAt),
      ),
    )
    .orderBy(asc(core_content_ai_translations.id))
    .limit(SWEEP_WINDOW);

  const superseded: number[] = [];
  const gone: { contentTypeId: string; recordIds: string[] }[] = [];
  const byType = Map.groupBy(rows, row => row.contentTypeId);
  for (const [contentTypeId, typeRows] of byType) {
    const model = autoTranslateModel(c, contentTypeId);
    if (!model) continue;
    const definition = contentDefinitionOf(model);
    const columns = model.columns as Record<string, PgColumn>;
    const localized = definition.autoTranslate.fields
      .filter(field => field.localized)
      .map(field => field.name);
    const shared = definition.autoTranslate.fields
      .filter(field => !field.localized)
      .map(field => field.name);
    const ids = [
      ...new Set(
        typeRows
          .map(row => parseContentIdOf(definition, row.recordId))
          .filter(id => id !== null),
      ),
    ];
    if (ids.length === 0) continue;

    const records = await db
      .select({
        id: columns.id,
        ...Object.fromEntries(
          shared.map(name => [name, columns[name]] as const),
        ),
      })
      .from(model.table)
      .where(inArray(columns.id, ids));
    const current = new Map(
      records.map(record => [
        contentIdKey(record.id as number | string),
        record as Record<string, unknown>,
      ]),
    );

    const variants = new Map<string, Map<string, Record<string, unknown>>>();
    const translation = model.translationColumns as null | Record<
      string,
      PgColumn
    >;
    if (
      definition.localization.enabled &&
      model.translationTable &&
      translation
    ) {
      const languages = new Map(
        (await listContentLanguages(c)).map(language => [
          language.id,
          language.locale,
        ]),
      );
      const rows = await db
        .select({
          itemId: translation.itemId,
          languageId: translation.languageId,
          ...Object.fromEntries(
            localized.map(name => [name, translation[name]] as const),
          ),
        })
        .from(model.translationTable)
        .where(inArray(translation.itemId, ids));
      for (const row of rows) {
        const locale = languages.get(row.languageId as number);
        if (!locale) continue;
        const key = contentIdKey(row.itemId as number | string);
        const byLocale =
          variants.get(key) ?? new Map<string, Record<string, unknown>>();
        byLocale.set(locale, row);
        variants.set(key, byLocale);
      }
    }

    const missing = new Set<string>();
    for (const row of typeRows) {
      const record = current.get(row.recordId);
      if (!record) {
        missing.add(row.recordId);
        continue;
      }
      const candidates = definition.localization.enabled
        ? [...(variants.get(row.recordId) ?? new Map())].map(
            ([locale, variant]) => ({
              sourceLocale: locale,
              value: localized.includes(row.field)
                ? variant[row.field]
                : record[row.field],
            }),
          )
        : [{ sourceLocale: null, value: record[row.field] }];
      const matches = candidates.some(
        candidate =>
          autoTranslateFingerprint({
            field: row.field,
            sourceLocale: candidate.sourceLocale,
            value: candidate.value,
          }) === row.sourceFingerprint,
      );
      if (!matches) superseded.push(row.id);
    }
    if (missing.size > 0) {
      gone.push({ contentTypeId, recordIds: [...missing] });
    }
  }

  const now = new Date();
  if (superseded.length > 0) {
    await db
      .update(core_content_ai_translations)
      .set({ supersededAt: now })
      .where(inArray(core_content_ai_translations.id, superseded));
  }

  let deleted = 0;
  for (const { contentTypeId, recordIds } of gone) {
    const [removed] = await Promise.all([
      db
        .delete(core_content_ai_translations)
        .where(
          and(
            eq(core_content_ai_translations.contentTypeId, contentTypeId),
            inArray(core_content_ai_translations.recordId, recordIds),
          ),
        )
        .returning({ id: core_content_ai_translations.id }),
      db
        .delete(core_content_ai_translation_jobs)
        .where(
          and(
            eq(core_content_ai_translation_jobs.contentTypeId, contentTypeId),
            inArray(core_content_ai_translation_jobs.recordId, recordIds),
          ),
        ),
    ]);
    deleted += removed.length;
  }

  const expired = await db
    .delete(core_content_ai_translations)
    .where(
      lt(
        core_content_ai_translations.supersededAt,
        new Date(now.getTime() - settings.retentionDays * DAY_MS),
      ),
    )
    .returning({ id: core_content_ai_translations.id });
  deleted += expired.length;

  await db
    .delete(core_content_ai_translation_jobs)
    .where(
      and(
        notInArray(core_content_ai_translation_jobs.status, [
          "pending",
          "running",
          "waiting_budget",
        ]),
        lt(
          core_content_ai_translation_jobs.updatedAt,
          new Date(now.getTime() - JOB_RETENTION_DAYS * DAY_MS),
        ),
      ),
    );

  const nextCursor = rows.length < SWEEP_WINDOW ? 0 : (rows.at(-1)?.id ?? 0);
  await db
    .insert(core_content_translation_settings)
    .values({ cleanupCursor: nextCursor, id: 1 })
    .onConflictDoUpdate({
      set: { cleanupCursor: nextCursor },
      target: core_content_translation_settings.id,
    });

  return { deleted, superseded: superseded.length };
};
