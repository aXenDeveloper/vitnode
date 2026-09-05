import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, count, eq, inArray, sql } from "drizzle-orm";

import type { RegisteredContentModel } from "./model";

import { core_content_schedules } from "../../database/content";
import { core_search_index } from "../../database/search";
import { normalizeContentLocale } from "../locale";
import { listContentLanguages } from "./language-resolver";
import { contentDefinitionOf } from "./model";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";

/** One locale's share of a content type's index, from every storage that has one. */
export interface ContentSearchDriftLocale {
  canonicalHealthy: boolean;
  /** Documents the canonical `core_search_index` holds for this locale. */
  canonicalIndexed: number;
  /** Published rows - or published translations - the database holds. */
  expected: number;

  locale: string;

  providerHealthy: boolean | null;
  /** Documents the active provider holds, or `null` when it cannot say. */
  providerIndexed: null | number;
}

/** What the active search provider could be asked, and what it answered. */
export interface ContentSearchDriftProvider {
  /** Why the provider could not be counted, when that is the answer. */
  error?: string;
  /** `null` when unverified - see {@link ContentSearchDriftLocale.providerHealthy}. */
  healthy: boolean | null;

  indexedTotal: null | number;
  name: string;

  verified: boolean;
}

export interface ContentSearchDrift {
  /** `true` when `core_search_index` matches the database, per locale and in total. */
  canonicalHealthy: boolean;
  /** Documents `core_search_index` holds for this content type, all locales. */
  canonicalIndexedTotal: number;
  contentTypeId: string;
  /** Published rows - or published translations - the database holds, all locales. */
  expectedTotal: number;

  healthy: boolean;
  locales: ContentSearchDriftLocale[];
  provider: ContentSearchDriftProvider;
}

export const contentSearchDrift = async (
  c: Context,
  { model }: Pick<RegisteredContentModel, "model">,
): Promise<ContentSearchDrift> => {
  const definition = contentDefinitionOf(model);
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

  const keys = [
    ...new Set([...expectedByLocale.keys(), ...indexedByLocale.keys()]),
  ].sort();

  const sum = (values: Iterable<number>): number => {
    let total = 0;
    for (const value of values) total += value;

    return total;
  };
  const expectedTotal = sum(expectedByLocale.values());
  const canonicalIndexedTotal = sum(indexedByLocale.values());

  const provider = await providerCounts(c, {
    canonicalTotal: canonicalIndexedTotal,
    contentTypeId,
    locales: keys,
  });

  const locales: ContentSearchDriftLocale[] = keys.map(locale => {
    const expected = expectedByLocale.get(locale) ?? 0;
    const canonicalIndexed = indexedByLocale.get(locale) ?? 0;
    // The canonical count stands in for the provider only when they are one
    // storage. Everywhere else an absent count means unverified, never healthy.
    const providerIndexed = provider.canonical
      ? canonicalIndexed
      : (provider.byLocale.get(locale) ?? null);

    return {
      canonicalHealthy: expected === canonicalIndexed,
      canonicalIndexed,
      expected,
      locale,
      providerHealthy:
        providerIndexed === null ? null : providerIndexed === expected,
      providerIndexed,
    };
  });

  // The total is part of *both* verdicts, not decoration on the provider one:
  // a canonical row in a locale nothing expects is a ghost too, and the grouped
  // query above already sees every locale the table holds.
  const canonicalHealthy =
    canonicalIndexedTotal === expectedTotal &&
    locales.every(entry => entry.canonicalHealthy);

  const providerHealthy = provider.verified
    ? provider.error === undefined &&
      provider.total === expectedTotal &&
      locales.every(entry => entry.providerHealthy === true)
    : null;

  return {
    canonicalHealthy,
    canonicalIndexedTotal,
    contentTypeId,
    expectedTotal,
    healthy: canonicalHealthy && providerHealthy === true,
    locales,
    provider: {
      ...(provider.error === undefined ? {} : { error: provider.error }),
      healthy: providerHealthy,
      indexedTotal: provider.total,
      name: provider.name,
      verified: provider.verified,
    },
  };
};

const providerCounts = async (
  c: Context,
  {
    canonicalTotal,
    contentTypeId,
    locales,
  }: { canonicalTotal: number; contentTypeId: string; locales: string[] },
): Promise<{
  byLocale: Map<string, number>;
  canonical: boolean;
  error?: string;
  name: string;
  total: null | number;
  verified: boolean;
}> => {
  const search = c.get("search");
  const name = search.name();

  if (search.isCanonicalStorage()) {
    return {
      byLocale: new Map(),
      canonical: true,
      name,
      total: canonicalTotal,
      verified: true,
    };
  }

  const unverified = {
    byLocale: new Map<string, number>(),
    canonical: false,
    name,
    total: null,
    verified: false,
  };

  const byLocale = new Map<string, number>();
  try {
    // Every locale, including ones nothing here knows the name of.
    const total = await search.countDocuments({ itemType: contentTypeId });
    if (total === null) return unverified;

    for (const locale of locales) {
      const counted = await search.countDocuments({
        itemType: contentTypeId,
        // The empty locale is what a language-agnostic document is stored
        // under, and it is a real value to filter on rather than "any".
        languageCode: locale,
      });
      if (counted === null) return unverified;
      byLocale.set(locale, counted);
    }

    return { byLocale, canonical: false, name, total, verified: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await logDiagnosticFailure(
      c,
      `${CONTENT_DIAGNOSTICS_LOG_PREFIX} ${JSON.stringify({
        contentTypeId,
        error: message,
        provider: name,
      })}`,
    );

    return {
      byLocale: new Map(),
      canonical: false,
      error: message,
      name,
      total: null,
      verified: true,
    };
  }
};

/** The prefix a provider diagnostic failure is logged behind. */
export const CONTENT_DIAGNOSTICS_LOG_PREFIX = "[content-diagnostics]";

/** Logging is best effort: it writes to the database, so it can fail too. */
const logDiagnosticFailure = async (
  c: Context,
  message: string,
): Promise<void> => {
  try {
    await c.get("log").error(message);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[VitNode] ${message}`);
  }
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
  const definition = contentDefinitionOf(model);
  const columns = model.columns;

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
      failedEffects: row.failedEffects,
      pending: row.pending,
      withErrors: row.withErrors,
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
  /** `null` for a content type without scheduling, which books nothing. */
  schedules: ContentScheduleHealth | null;
  /** `null` for a content type without `search`, which indexes nothing. */
  search: ContentSearchDrift | null;
}

export interface ContentEngineDiagnostics {
  contentTypes: ContentTypeDiagnostic[];
  /**
   * Whether anything scheduled committed and was never announced.
   *
   * A *pending* schedule is normal - it has not fired yet - and so is a pending
   * one whose last attempt threw, because the transition has not happened and
   * the queue is still retrying it. `effectsError` is the one that matters: the
   * record **is** published and nobody was told, and no amount of waiting fixes
   * it on its own.
   */
  effectsHealthy: boolean;
  /**
   * `searchHealthy && effectsHealthy`.
   *
   * Explicit dimensions rather than one number, because `healthy: true` beside
   * `failedEffects: 15` is worse than no answer - it tells an operator to stop
   * looking.
   */
  healthy: boolean;
  /**
   * Whether every searchable content type agrees with the database - in the
   * canonical table **and** in the active provider.
   *
   * A provider that offers no diagnostics leaves this `false`: unverified is not
   * healthy, and the per-content-type `provider.verified` says which it was.
   */
  searchHealthy: boolean;
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
    const definition = contentDefinitionOf(entry.model);

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

  const searchHealthy = contentTypes.every(
    entry => entry.search === null || entry.search.healthy,
  );
  const effectsHealthy = contentTypes.every(
    entry => (entry.schedules?.failedEffects ?? 0) === 0,
  );

  return {
    contentTypes,
    effectsHealthy,
    healthy: searchHealthy && effectsHealthy,
    searchHealthy,
  };
};
