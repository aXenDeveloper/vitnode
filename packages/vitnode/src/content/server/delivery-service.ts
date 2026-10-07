import type { Context } from "hono";

import type {
  ContentDeliveryAlternate,
  ContentDeliveryHreflang,
  ContentDeliveryRobots,
  ContentDeliverySeo,
} from "../delivery";
import type { ContentId, ContentIdOf } from "../ids";
import type { ContentSitemapEntry } from "../sitemap";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliverySitemapPage } from "./delivery-sitemap";
import type { ContentModel } from "./model";
import type { ContentSlugHistoryEntry } from "./slug-history-model";

import { CONTENT_DELIVERY_REDIRECT_STATUS } from "../const";
import {
  contentDeliveryHreflang,
  contentDeliveryInternalPath,
  contentDeliveryOpenGraph,
  contentDeliveryPublicUrl,
  contentDeliveryRobots,
  contentDeliverySeo,
  contentDeliveryUrl,
  parseContentDeliveryPath,
} from "../delivery";
import { ContentDeliveryNotEnabled } from "../errors";
import { parseContentId } from "../ids";
import { contentLocalesMatch, normalizeContentLocale } from "../locale";
import { contentPublicHref } from "../public-url";
import { readDeliveryAlternates } from "./delivery-alternates";
import { readContentDeliverySitemapPage } from "./delivery-sitemap";
import { findContentLanguage, listContentLanguages } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
import { createContentSlugHistoryModel } from "./slug-history-model";

export interface ContentDeliveryMetadata {
  /** Real published translations only. Empty for a nonlocalized content type. */
  alternates: ContentDeliveryAlternate[];

  canonicalInternalPath: null | string;
  canonicalPath: null | string;
  canonicalUrl?: null | string;
  /** Framework-neutral `hreflang`, ready for an adapter to translate. */
  hreflang: ContentDeliveryHreflang;
  /** Whether `locale` differs from `requestedLocale`. */
  isFallback: boolean;

  itemId: ContentId | null;
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

export type ContentDeliveryResolution =
  | (ContentDeliveryMetadata & { type: "content" })
  | { location: string; status: 308; type: "redirect" }
  | { type: "not_found" };

export interface ContentDeliveryReadOptions {
  host?: null | string;
  /** The language to read, for a localized content type. */
  locale?: string;
  /** Turns every path in the result into an absolute URL as well. */
  origin?: string;
}

export interface ContentDeliverySitemapArgs {
  /** The last `itemId` of the previous page. Keyset, never an offset. */
  cursor?: ContentId;
  /** Defaults to `CONTENT_SITEMAP_DEFAULT_PAGE_SIZE`, capped at the protocol's. */
  limit?: number;
  /** Required for a localized content type; each language is its own sitemap. */
  locale?: string;
}

export interface ContentDeliveryService {
  alternates: (itemId: ContentId) => Promise<ContentDeliveryAlternate[]>;
  /** Delivery metadata by identifier, honouring the content type's fallback. */
  findById: (
    itemId: ContentId,
    options?: ContentDeliveryReadOptions,
  ) => Promise<ContentDeliveryMetadata | null>;

  history: (
    itemId: ContentId,
    options?: { locale?: string },
  ) => Promise<ContentSlugHistoryEntry[]>;

  resolvePath: (
    path: string,
    options?: { host?: null | string; origin?: string },
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
  const routing = contentLocaleRouting(c);
  const buildPublic = model.publicService;
  if (!buildPublic) throw new ContentDeliveryNotEnabled({ contentTypeId });

  const slugHistory = createContentSlugHistoryModel({
    c,
    definition,
    pluginId,
  });

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
      itemId: ContentId | null;
      origin?: string;
      requestedLocale: null | string;
    },
  ): Promise<ContentDeliveryMetadata> => {
    const locale = localeOf(definition, row);
    const slug = slugOf(definition, row);
    const canonical =
      slug === null
        ? null
        : contentDeliveryPublicUrl({ definition, locale, routing, slug });
    const canonicalPath = canonical?.pathname ?? null;
    const canonicalInternalPath =
      canonical === null || slug === null
        ? null
        : contentDeliveryInternalPath({ definition, slug });
    const alternates =
      localized && itemId !== null ? await readAlternates(itemId) : [];

    return {
      alternates,
      canonicalInternalPath,
      canonicalPath,
      ...(canonical?.origin === undefined
        ? origin === undefined
          ? {}
          : {
              canonicalUrl: contentDeliveryUrl({ origin, path: canonicalPath }),
            }
        : { canonicalUrl: contentPublicHref(canonical) }),
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
    itemId: ContentId,
  ): Promise<ContentDeliveryAlternate[]> =>
    localized ? await readDeliveryAlternates({ c, itemId, model }) : [];

  const strictCanonical = async (
    itemId: ContentId,
    locale: null | string,
    host: null | string | undefined,
  ): Promise<null | { location: string; slug: string }> => {
    const row = await buildPublic(c).findById(
      itemId as ContentIdOf<TDefinition>,
      {
        locale: locale ?? undefined,
      },
    );
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
    if (slug === null) return null;

    const url = contentDeliveryPublicUrl({
      definition,
      host,
      locale: served,
      routing,
      slug,
    });

    return url === null ? null : { location: contentPublicHref(url), slug };
  };

  const localeFor = (locale: string | undefined): null | string => {
    if (!localized) return null;

    return normalizeContentLocale(
      locale ?? definition.localization.defaultLocale,
    );
  };

  const resolve = async (
    slug: string,
    { host, locale, origin }: ContentDeliveryReadOptions = {},
  ): Promise<ContentDeliveryResolution> => {
    const requestedLocale = localeFor(locale);

    const row = await buildPublic(c).findBySlug(slug, {
      fallback: true,
      locale,
    });
    if (row) {
      const values = row as Record<string, unknown>;
      const itemId = parseContentId(definition.idStrategy, values.id);

      if (itemId !== null && slugOf(definition, values) !== slug) {
        const destination = await strictCanonical(
          itemId,
          requestedLocale,
          host,
        );
        if (destination === null) return { type: "not_found" };

        return {
          location: destination.location,
          status: CONTENT_DELIVERY_REDIRECT_STATUS,
          type: "redirect",
        };
      }

      return {
        ...(await metadataFor(values, {
          // Only what the public projection actually carries - see
          // `ContentDeliveryMetadata.itemId`.
          itemId,
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
    const destination = await strictCanonical(
      owner.itemId,
      requestedLocale,
      host,
    );

    // Unpublished, deleted, or published only in another language: a historical URL
    // must not become a way to reach content that is not public. 404 rather than a
    // redirect to a page that would itself 404.
    if (destination === null || destination.slug === owner.slug) {
      return { type: "not_found" };
    }

    return {
      location: destination.location,
      status: CONTENT_DELIVERY_REDIRECT_STATUS,
      type: "redirect",
    };
  };

  const currentHistoryPaths = async (
    entries: ContentSlugHistoryEntry[],
  ): Promise<ContentSlugHistoryEntry[]> => {
    if (entries.length === 0) return entries;

    const languages = await listContentLanguages(c);
    const localeOfLanguage = new Map(
      languages.map(language => [language.id, language.locale]),
    );

    return entries.map(entry => {
      const locale =
        entry.languageId === null
          ? localized
            ? definition.localization.defaultLocale
            : null
          : (localeOfLanguage.get(entry.languageId) ?? null);
      const url =
        locale === null && localized
          ? null
          : contentDeliveryPublicUrl({
              definition,
              locale,
              routing,
              slug: entry.slug,
            });

      return url === null ? entry : { ...entry, path: url.pathname };
    });
  };

  return {
    alternates: async itemId => await readAlternates(itemId),

    findById: async (itemId, { locale, origin } = {}) => {
      const row = await buildPublic(c).findById(
        itemId as ContentIdOf<TDefinition>,
        { locale },
      );
      if (!row) return null;

      return await metadataFor(row, {
        itemId,
        origin,
        requestedLocale: localeFor(locale),
      });
    },

    history: async (itemId, { locale } = {}) => {
      const languageId = await historyLanguageId(
        locale === undefined ? null : normalizeContentLocale(locale),
      );

      const entries = await slugHistory.list({
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

      return await currentHistoryPaths(entries);
    },

    resolvePath: async (path, { host, origin } = {}) => {
      const parts = parseContentDeliveryPath(definition, path, {
        host,
        routing,
      });
      if (!parts) return { type: "not_found" };

      return await resolve(parts.slug, {
        host,
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
