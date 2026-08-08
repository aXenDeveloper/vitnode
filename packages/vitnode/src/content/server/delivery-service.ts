import type { Context } from "hono";

import type {
  ContentDeliveryAlternate,
  ContentDeliveryHreflang,
  ContentDeliveryRobots,
  ContentDeliverySeo,
} from "../delivery";
import type { ContentSitemapEntry } from "../sitemap";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliverySitemapPage } from "./delivery-sitemap";
import type { ContentModel } from "./model";
import type { ContentSlugHistoryEntry } from "./slug-history-model";

import { CONTENT_DELIVERY_REDIRECT_STATUS } from "../const";
import {
  contentDeliveryHreflang,
  contentDeliveryOpenGraph,
  contentDeliveryPath,
  contentDeliveryRobots,
  contentDeliverySeo,
  contentDeliveryUrl,
  parseContentDeliveryPath,
} from "../delivery";
import { ContentDeliveryNotEnabled } from "../errors";
import { contentLocalesMatch, normalizeContentLocale } from "../locale";
import { readDeliveryAlternates } from "./delivery-alternates";
import { readContentDeliverySitemapPage } from "./delivery-sitemap";
import { findContentLanguage } from "./language-resolver";
import { createContentSlugHistoryModel } from "./slug-history-model";

/**
 * Everything a page needs to render one record's `<head>`.
 *
 * Two locales, not one, and the distinction is the whole reason this type exists:
 * `requestedLocale` is what the URL asked for and `locale` is what the reader is
 * actually being shown. With `localization.fallback: "default"` those differ, and a
 * canonical URL built from the first would announce `/pl/articles/x` for an English
 * translation - a URL that answers 404, self-referentially declared canonical.
 */
export interface ContentDeliveryMetadata {
  /** Real published translations only. Empty for a nonlocalized content type. */
  alternates: ContentDeliveryAlternate[];
  /**
   * The canonical path of the version actually being served.
   *
   * `null` only when the record has no public URL in that language at all, which
   * for a resolved record means its slug is empty - a row written straight into the
   * database rather than through the engine.
   */
  canonicalPath: null | string;
  /** Present only when the caller supplied an origin. */
  canonicalUrl?: null | string;
  /** Framework-neutral `hreflang`, ready for an adapter to translate. */
  hreflang: ContentDeliveryHreflang;
  /** Whether `locale` differs from `requestedLocale`. */
  isFallback: boolean;
  /**
   * The record's identifier, when the public projection carries one.
   *
   * `null` for a content type whose `publicApi.fields` withholds `id`, and that is
   * deliberate rather than a gap: delivery metadata is read off the **public**
   * projection, so it cannot report a column the public API declined to publish.
   * Expose `"id"` in the allowlist and it is always present.
   *
   * A resolution reached through {@link ContentDeliveryService.findById} always
   * carries it, because the caller supplied it.
   */
  itemId: null | number;
  /** The language this response is actually in. */
  locale: null | string;
  /** `null` unless `delivery.seo.openGraph` is configured. */
  openGraph: ContentDeliverySeo | null;
  /** What was asked for, normalized. `null` for a nonlocalized content type. */
  requestedLocale: null | string;
  /** `null` unless `delivery.seo.noIndexField` is configured. */
  robots: ContentDeliveryRobots | null;
  seo: ContentDeliverySeo;
}

/**
 * What one public path resolves to.
 *
 * A discriminated union rather than a nullable metadata object, because the three
 * outcomes need three different HTTP responses and a caller that had to infer
 * which one it was holding would get it wrong. `redirect` carries its own status
 * so a frontend never hardcodes one.
 */
export type ContentDeliveryResolution =
  | (ContentDeliveryMetadata & { type: "content" })
  | { location: string; status: 308; type: "redirect" }
  | { type: "not_found" };

export interface ContentDeliveryReadOptions {
  /** The language to read, for a localized content type. */
  locale?: string;
  /** Turns every path in the result into an absolute URL as well. */
  origin?: string;
}

export interface ContentDeliverySitemapArgs {
  /** The last `itemId` of the previous page. Keyset, never an offset. */
  cursor?: number;
  /** Defaults to `CONTENT_SITEMAP_DEFAULT_PAGE_SIZE`, capped at the protocol's. */
  limit?: number;
  /** Required for a localized content type; each language is its own sitemap. */
  locale?: string;
}

/**
 * The read-only delivery layer of one content type.
 *
 * There is deliberately **no mutation here at all**. Slug history is written by
 * the editorial services, inside the transaction that moves the slug, because that
 * is the only place the two can be atomic - and exposing a `reserve` here would be
 * an invitation to write one without the other. This object answers questions.
 *
 * Every answer is derived from the **public** projection, not from the base row:
 * `findById` and `resolveSlug` go through `model.publicService`, so the publication
 * predicate, the field allowlist and the Stage 5 fallback rules are the ones
 * already tested rather than a second implementation that agrees on the day it is
 * written. That is also what makes "SEO cannot leak a private field" true here for
 * free: a private column is never fetched, so it is not in the row this reads.
 */
export interface ContentDeliveryService {
  /**
   * Every published translation's URL, in a stable order.
   *
   * Only real ones. A locale served by the fallback has no URL of its own, so it
   * is absent - listing it would announce an `hreflang` alternate that answers
   * 404 and invite a crawler to index the same content twice.
   */
  alternates: (itemId: number) => Promise<ContentDeliveryAlternate[]>;
  /** Delivery metadata by identifier, honouring the content type's fallback. */
  findById: (
    itemId: number,
    options?: ContentDeliveryReadOptions,
  ) => Promise<ContentDeliveryMetadata | null>;
  /**
   * Every address this record has ever answered to, current one first.
   *
   * Read-only, and the AdminCP's delivery panel is its only caller today. It needs
   * no permission of its own beyond the one that let the reader see the record.
   */
  history: (
    itemId: number,
    options?: { locale?: string },
  ) => Promise<ContentSlugHistoryEntry[]>;
  /**
   * Resolves a whole public path: `/pl/articles/stary-slug`.
   *
   * The one method a catch-all route calls. It parses the path with the same rules
   * {@link contentDeliveryPath} builds it by, so a path this engine did not produce
   * is `not_found` rather than a guess.
   */
  resolvePath: (
    path: string,
    options?: { origin?: string },
  ) => Promise<ContentDeliveryResolution>;
  /** The same resolution, when the caller has already split locale from slug. */
  resolveSlug: (
    slug: string,
    options?: ContentDeliveryReadOptions,
  ) => Promise<ContentDeliveryResolution>;
  /** One page of sitemap entries. Cursor-paginated and deterministic. */
  sitemap: (
    args?: ContentDeliverySitemapArgs,
  ) => Promise<ContentDeliverySitemapPage>;
}

/** The exposed slug of a public row, or `null` when it has none. */
const slugOf = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): null | string => {
  const value = row[definition.publicApi.slugField];

  return typeof value === "string" && value !== "" ? value : null;
};

/** The language a public row is actually in, off the projection's own key. */
const localeOf = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): null | string => {
  if (!definition.localization.enabled) return null;

  return typeof row.locale === "string" ? row.locale : null;
};

export const createContentDeliveryService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  model,
  pluginId,
}: {
  c: Context;
  model: ContentModel<TDefinition>;
  pluginId: string;
}): ContentDeliveryService => {
  const { definition } = model;
  const contentTypeId = definition.id;

  if (!definition.delivery.enabled || !definition.publicApi.enabled) {
    throw new ContentDeliveryNotEnabled({ contentTypeId });
  }

  const localized = definition.localization.enabled;
  const buildPublic = model.publicService;
  if (!buildPublic) throw new ContentDeliveryNotEnabled({ contentTypeId });

  const slugHistory = createContentSlugHistoryModel({
    c,
    definition,
    pluginId,
  });

  /**
   * The language a historical URL belongs to.
   *
   * `null` whenever the slug is shared, which covers both a nonlocalized content
   * type and a localized one whose slug lives on the base row - in the second case
   * every language answers to the same segment, so one reservation is correct for
   * all of them.
   */
  const historyLanguageId = async (
    locale: null | string,
  ): Promise<null | number> => {
    if (definition.delivery.slugScope !== "localized" || locale === null) {
      return null;
    }

    const language = await findContentLanguage(c, locale);

    return language?.id ?? null;
  };

  const metadataFor = async (
    row: Record<string, unknown>,
    {
      itemId,
      origin,
      requestedLocale,
    }: {
      itemId: null | number;
      origin?: string;
      requestedLocale: null | string;
    },
  ): Promise<ContentDeliveryMetadata> => {
    const locale = localeOf(definition, row);
    const slug = slugOf(definition, row);
    const canonicalPath =
      slug === null ? null : contentDeliveryPath({ definition, locale, slug });
    const alternates =
      localized && itemId !== null ? await readAlternates(itemId) : [];

    return {
      alternates,
      canonicalPath,
      ...(origin === undefined
        ? {}
        : {
            canonicalUrl: contentDeliveryUrl({ origin, path: canonicalPath }),
          }),
      hreflang: contentDeliveryHreflang({ alternates, definition }),
      // Compared on the normalized forms, so `PL` asking and `pl` answering is not
      // reported as a fallback.
      isFallback:
        requestedLocale !== null &&
        locale !== null &&
        !contentLocalesMatch(requestedLocale, locale),
      itemId,
      locale,
      openGraph: contentDeliveryOpenGraph(definition, row),
      requestedLocale,
      robots: contentDeliveryRobots(definition, row),
      seo: contentDeliverySeo(definition, row),
    };
  };

  const readAlternates = async (
    itemId: number,
  ): Promise<ContentDeliveryAlternate[]> =>
    localized ? await readDeliveryAlternates({ c, itemId, model }) : [];

  /**
   * The record's canonical path **in one specific language**, or `null`.
   *
   * Strict about the language on purpose. `publicService.findById` may fall back,
   * and a redirect must not: sending `/pl/articles/stary-slug` to the English
   * canonical would answer a Polish URL with an English page and permanently tell
   * a crawler that is correct. So a row that came back in another language is
   * treated as "this locale has no published version", which is what it is.
   */
  const strictCanonicalPath = async (
    itemId: number,
    locale: null | string,
  ): Promise<null | string> => {
    const row = await buildPublic(c).findById(itemId, {
      locale: locale ?? undefined,
    });
    if (!row) return null;

    const values = row as Record<string, unknown>;
    const served = localeOf(definition, values);
    if (
      locale !== null &&
      served !== null &&
      !contentLocalesMatch(locale, served)
    ) {
      return null;
    }

    const slug = slugOf(definition, values);

    return slug === null
      ? null
      : contentDeliveryPath({ definition, locale: served, slug });
  };

  const resolve = async (
    slug: string,
    { locale, origin }: ContentDeliveryReadOptions = {},
  ): Promise<ContentDeliveryResolution> => {
    const requestedLocale =
      localized && locale !== undefined ? normalizeContentLocale(locale) : null;

    // The live record first, and strictly by slug: a URL belongs to the language
    // it was published under, so `findBySlug` never falls back.
    const row = await buildPublic(c).findBySlug(slug, { locale });
    if (row) {
      const values = row as Record<string, unknown>;

      return {
        ...(await metadataFor(values, {
          // Only what the public projection actually carries - see
          // `ContentDeliveryMetadata.itemId`.
          itemId: typeof values.id === "number" ? values.id : null,
          origin,
          requestedLocale,
        })),
        type: "content",
      };
    }

    if (!definition.delivery.redirects.enabled) return { type: "not_found" };

    const languageId = await historyLanguageId(requestedLocale);
    const owner = await slugHistory.owner({ languageId, slug });
    if (!owner) return { type: "not_found" };

    // Straight to the record's **current** address, never to the next entry in the
    // chain. `a -> b -> c` collapses here rather than in the data: the database
    // keeps the chronology, and the resolver answers with one hop.
    const destination = await strictCanonicalPath(
      owner.itemId,
      requestedLocale,
    );

    // Unpublished, deleted, or published only in another language: a historical URL
    // must not become a way to reach content that is not public. 404 rather than a
    // redirect to a page that would itself 404.
    if (destination === null || destination === owner.path) {
      return { type: "not_found" };
    }

    return {
      location: destination,
      status: CONTENT_DELIVERY_REDIRECT_STATUS,
      type: "redirect",
    };
  };

  return {
    alternates: async itemId => await readAlternates(itemId),

    findById: async (itemId, { locale, origin } = {}) => {
      const row = await buildPublic(c).findById(itemId, { locale });
      if (!row) return null;

      return await metadataFor(row, {
        itemId,
        origin,
        requestedLocale:
          localized && locale !== undefined
            ? normalizeContentLocale(locale)
            : null,
      });
    },

    history: async (itemId, { locale } = {}) => {
      const languageId = await historyLanguageId(
        locale === undefined ? null : normalizeContentLocale(locale),
      );

      return await slugHistory.list({
        itemId,
        // `undefined` - not `null` - when the caller named no locale, so the query
        // is unscoped rather than scoped to the shared rows. A shared slug's
        // history really is `languageId IS NULL`, and asking for "everything" has
        // to stay distinguishable from asking for "the shared ones".
        languageId:
          definition.delivery.slugScope === "localized" && locale === undefined
            ? undefined
            : languageId,
      });
    },

    resolvePath: async (path, { origin } = {}) => {
      const parts = parseContentDeliveryPath(definition, path);
      if (!parts) return { type: "not_found" };

      return await resolve(parts.slug, {
        locale: parts.locale ?? undefined,
        origin,
      });
    },

    resolveSlug: async (slug, options) => await resolve(slug, options),

    sitemap: async (args = {}) =>
      await readContentDeliverySitemapPage({ args, c, model }),
  };
};

/** Re-exported so a caller need not reach past this module for the entry type. */
export type { ContentSitemapEntry };
