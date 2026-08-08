import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, count, eq, inArray, sql } from "drizzle-orm";

import type { RegisteredContentModel } from "./model";

import { core_content_schedules } from "../../database/content";
import { core_search_index } from "../../database/search";
import { normalizeContentLocale } from "../locale";
import { listContentLanguages } from "./language-resolver";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";

/**
 * Operational diagnostics for the Content Engine.
 *
 * Deliberately small, and deliberately **not** a monitoring product. It answers
 * three questions an operator actually asks at three in the morning, and
 * nothing else:
 *
 * 1. *Is the search index telling the truth?* - the database is the source of
 *    truth, so "how many documents should there be" is a `COUNT` over published
 *    rows, and "how many are there" is a `COUNT` over `core_search_index`. A
 *    difference is drift, and drift is repaired by a rebuild.
 * 2. *Did anything scheduled fail to announce itself?* - a scheduled transition
 *    that committed but whose event, index write or cache expiry did not is
 *    recorded on the schedule row as `effectsError`. One count per content type
 *    turns "somewhere in the install" into "this content type".
 * 3. *Which content types are even in play?* - what is registered, and which of
 *    the optional subsystems each one has switched on.
 *
 * No Prometheus, no time series, no dashboards - the install has none of those
 * and Stage 7 does not add them. Everything here is a handful of aggregate
 * queries, computed on demand, behind an admin permission.
 */

/** One locale's share of a content type's index, expected against actual. */
export interface ContentSearchDriftLocale {
  /**
   * `true` when the two counts agree.
   *
   * A count is not a checksum: two documents can be stale and still count as
   * two. It is the cheap check that catches the failure that actually happens -
   * a live sync that threw, or a rebuild that stopped halfway - and it costs two
   * aggregates rather than a full comparison.
   */
  healthy: boolean;
  /** Documents actually in the index for this locale. */
  indexed: number;
  /**
   * `""` for a content type that is not localized.
   *
   * The empty string is what `core_search_index` stores for language-agnostic
   * content, so it is the honest key here rather than `null` - it is the value
   * the row really holds.
   */
  locale: string;
  /** Published rows (or published translations) the database holds. */
  expected: number;
}

export interface ContentSearchDrift {
  contentTypeId: string;
  /** `true` when every locale agrees. */
  healthy: boolean;
  locales: ContentSearchDriftLocale[];
}

/**
 * Compares what the database says should be indexed against what is.
 *
 * Two aggregates per content type, whatever its size: `GROUP BY languageCode`
 * over the index, and one `COUNT` (or one grouped `COUNT` for a localized
 * content type) over the published rows. Neither reads a row body, so this stays
 * cheap on a table with a hundred thousand articles.
 *
 * The expected side is deliberately the **same predicate the indexer uses** -
 * `publishedCondition`, and for a localized content type the base row's
 * predicate `AND` the translation's. Re-deriving "published" here would let the
 * diagnostic disagree with the thing it is diagnosing, which is the one way a
 * health check is worse than none.
 */
export const contentSearchDrift = async (
  c: Context,
  { model }: Pick<RegisteredContentModel, "model">,
): Promise<ContentSearchDrift> => {
  const { definition } = model;
  const contentTypeId = definition.id;

  const indexedRows = await c
    .get("db")
    .select({
      documents: count(),
      languageCode: core_search_index.languageCode,
    })
    .from(core_search_index)
    .where(eq(core_search_index.itemType, contentTypeId))
    .groupBy(core_search_index.languageCode);

  const indexedByLocale = new Map(
    indexedRows.map(row => [
      normalizeContentLocale(row.languageCode),
      row.documents,
    ]),
  );

  const expectedByLocale = await expectedDocuments(c, model);

  const locales = [
    ...new Set([...expectedByLocale.keys(), ...indexedByLocale.keys()]),
  ]
    .sort()
    .map(locale => {
      const expected = expectedByLocale.get(locale) ?? 0;
      const indexed = indexedByLocale.get(locale) ?? 0;

      return { expected, healthy: expected === indexed, indexed, locale };
    });

  return {
    contentTypeId,
    healthy: locales.every(entry => entry.healthy),
    locales,
  };
};

/**
 * How many documents this content type's rows *should* produce, per locale.
 *
 * `publication` is what makes a row indexable at all, so a content type without
 * it has nothing to expect and returns an empty map rather than counting every
 * draft - the indexer would not have written them either.
 */
const expectedDocuments = async (
  c: Context,
  model: RegisteredContentModel["model"],
): Promise<Map<string, number>> => {
  const { definition } = model;
  const columns = model.columns as Record<string, PgColumn>;

  if (!definition.publication.enabled) return new Map();

  const published = publicationColumns(definition, columns);

  if (!definition.localization.enabled) {
    const [row] = await c
      .get("db")
      .select({ value: count() })
      .from(model.table)
      .where(publishedCondition(published));

    // The empty locale, because that is the `languageCode` a non-localized
    // document is stored under - not a missing value, an actual `''`.
    return new Map([["", row?.value ?? 0]]);
  }

  const translationTable: null | PgTable = model.translationTable;
  const translationColumns: null | Record<string, PgColumn> =
    model.translationColumns;
  if (!translationTable || !translationColumns) return new Map();

  const translation = contentTranslationPublicationColumns(
    definition,
    translationColumns,
  );

  const rows = await c
    .get("db")
    .select({
      languageId: translationColumns.languageId,
      value: count(),
    })
    .from(translationTable)
    .innerJoin(model.table, eq(translationColumns.itemId, columns.id))
    .where(and(publishedCondition(published), publishedCondition(translation)))
    .groupBy(translationColumns.languageId);

  const languages = await listContentLanguages(c);
  const localeOf = new Map(
    languages.map(language => [language.id, language.locale]),
  );

  const byLocale = new Map<string, number>();
  for (const row of rows) {
    const locale = localeOf.get(row.languageId as number);
    // A translation whose language row is gone indexes under no locale, so it is
    // expected to produce no document - which is exactly what the indexer does
    // with it. Counting it here would report permanent drift nothing can repair.
    if (locale === undefined) continue;

    const key = normalizeContentLocale(locale);
    byLocale.set(key, (byLocale.get(key) ?? 0) + row.value);
  }

  return byLocale;
};

export interface ContentScheduleHealth {
  /**
   * Transitions that committed but whose announcements have not been delivered.
   *
   * The number worth alerting on: the record *is* published, and nobody has been
   * told. The effects task retries on the queue's backoff, so a non-zero value
   * that stays non-zero is an outage rather than a blip.
   */
  failedEffects: number;
  /** Bookings still waiting to fire. */
  pending: number;
  /** Pending bookings whose last run threw. */
  withErrors: number;
}

/**
 * Schedule health for a set of content types, in one query.
 *
 * Grouped rather than looped: an install with thirty schedulable content types
 * should cost one aggregate, not thirty round trips.
 */
export const contentScheduleHealth = async (
  c: Context,
  contentTypeIds: readonly string[],
): Promise<Map<string, ContentScheduleHealth>> => {
  const result = new Map<string, ContentScheduleHealth>();
  if (contentTypeIds.length === 0) return result;

  const rows = await c
    .get("db")
    .select({
      contentTypeId: core_content_schedules.contentTypeId,
      failedEffects: sql<number>`count(*) filter (where ${core_content_schedules.effectsError} is not null)::int`,
      pending: sql<number>`count(*) filter (where ${core_content_schedules.status} = 'pending')::int`,
      withErrors: sql<number>`count(*) filter (where ${core_content_schedules.status} = 'pending' and ${core_content_schedules.lastError} is not null)::int`,
    })
    .from(core_content_schedules)
    .where(inArray(core_content_schedules.contentTypeId, [...contentTypeIds]))
    .groupBy(core_content_schedules.contentTypeId);

  for (const row of rows) {
    result.set(row.contentTypeId, {
      failedEffects: Number(row.failedEffects),
      pending: Number(row.pending),
      withErrors: Number(row.withErrors),
    });
  }

  return result;
};

export interface ContentTypeDiagnostic {
  contentTypeId: string;
  features: {
    editorial: boolean;
    localization: boolean;
    publicApi: boolean;
    publication: boolean;
    scheduling: boolean;
    search: boolean;
  };
  pluginId: string;
  /** `null` for a content type without `search`, which indexes nothing. */
  search: ContentSearchDrift | null;
  /** `null` for a content type without scheduling, which books nothing. */
  schedules: ContentScheduleHealth | null;
}

export interface ContentEngineDiagnostics {
  contentTypes: ContentTypeDiagnostic[];
  /** `true` when every searchable content type's index agrees with the database. */
  healthy: boolean;
}

/**
 * One pass over every registered content type.
 *
 * Sorted by id so two calls - and two processes - report the same order, which
 * is what makes a diff between them readable.
 */
export const contentEngineDiagnostics = async (
  c: Context,
): Promise<ContentEngineDiagnostics> => {
  const registered = [...(c.get("core")?.contentModels ?? [])].sort((a, b) =>
    a.model.definition.id.localeCompare(b.model.definition.id),
  );

  const schedulable = registered
    .filter(entry => entry.model.definition.editorial.scheduling.enabled)
    .map(entry => entry.model.definition.id);
  const schedules = await contentScheduleHealth(c, schedulable);

  const contentTypes: ContentTypeDiagnostic[] = [];
  for (const entry of registered) {
    const { definition } = entry.model;

    contentTypes.push({
      contentTypeId: definition.id,
      features: {
        editorial: definition.editorial.enabled,
        localization: definition.localization.enabled,
        publicApi: definition.publicApi.enabled,
        publication: definition.publication.enabled,
        scheduling: definition.editorial.scheduling.enabled,
        search: definition.search.enabled,
      },
      pluginId: entry.pluginId,
      search: definition.search.enabled
        ? await contentSearchDrift(c, entry)
        : null,
      schedules: definition.editorial.scheduling.enabled
        ? (schedules.get(definition.id) ?? {
            failedEffects: 0,
            pending: 0,
            withErrors: 0,
          })
        : null,
    });
  }

  return {
    contentTypes,
    healthy: contentTypes.every(entry => entry.search?.healthy !== false),
  };
};
