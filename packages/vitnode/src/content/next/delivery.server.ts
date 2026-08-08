import "server-only";

import type {
  ContentDeliveryAlternate,
  ContentDeliveryRobots,
  ContentDeliverySeo,
} from "../delivery";
import type { ContentSitemapEntry } from "../sitemap";
import type { DeliverableContentTypeDefinition } from "../types";

import { rawApiFetch } from "../../lib/fetcher/raw";
import {
  contentDeliveryRedirectTag,
  contentDeliverySitemapTag,
  contentDeliveryTag,
} from "../cache";
import { CONTENT_SITEMAP_DEFAULT_PAGE_SIZE } from "../const";
import { contentDeliveryUrl } from "../delivery";

/**
 * The Next.js side of Content Delivery.
 *
 * A **thin adapter**, and the thinness is the point: the core engine returns
 * framework-neutral delivery metadata, and this module turns it into the two
 * shapes Next.js asks for - a `generateMetadata` return value and a `sitemap.ts`
 * return value. Nothing here decides anything; move to Astro and you write a
 * different forty lines against the same service.
 *
 * It reads over HTTP rather than through `model.deliveryService`, because in
 * VitNode's split deployment the web app is not the process that holds the
 * database. A single-process install can still call the service directly and skip
 * this entirely.
 */

/** The delivery metadata of one record, as the API returns it. */
export interface ContentDeliveryResponse {
  alternates: ContentDeliveryAlternate[];
  canonicalPath: null | string;
  hreflang: { languages: Record<string, string>; xDefault?: string };
  isFallback: boolean;
  /** `null` when the content type's public allowlist withholds `id`. */
  itemId: null | number;
  locale: null | string;
  openGraph: ContentDeliverySeo | null;
  requestedLocale: null | string;
  robots: ContentDeliveryRobots | null;
  seo: ContentDeliverySeo;
}

export type ContentDeliveryResolutionResponse =
  | (ContentDeliveryResponse & { type: "content" })
  | { location: string; status: number; type: "redirect" }
  | { type: "not_found" };

/**
 * The subset of Next's `Metadata` this adapter produces.
 *
 * Structural rather than an `import type { Metadata } from "next"`, so the core
 * package does not grow a compile-time dependency on the framework's type surface
 * for four keys. It is assignable to `Metadata`, which is what a
 * `generateMetadata` needs it to be.
 */
export interface ContentDeliveryNextMetadata {
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
  description?: string;
  openGraph?: {
    description?: string;
    title?: string;
    url?: string;
  };
  robots?: { follow: boolean; index: boolean };
  title?: string;
}

const deliveryModule = (definition: DeliverableContentTypeDefinition): string =>
  `content/${definition.publicApi.path}`;

/**
 * Resolves one public URL through the API, cached and tagged.
 *
 * Two tags, because one response answers two questions that expire at different
 * moments: the record's delivery metadata, and "does this slug still resolve here".
 * A slug change invalidates the second for the *old* address and the first for the
 * record, and tagging both is what makes a moved page stop being served from its
 * former URL.
 *
 * Only a `200` is stored, and a `not_found` is a `200` with a body - so a URL that
 * does not exist yet is not cached as a negative, and publishing the record makes it
 * resolve immediately.
 */
export const contentDeliveryResolve = async ({
  definition,
  locale,
  pluginId,
  slug,
}: {
  definition: DeliverableContentTypeDefinition;
  /** The language to resolve in, for a localized content type. */
  locale?: string;
  pluginId: string;
  slug: string;
}): Promise<ContentDeliveryResolutionResponse> => {
  const effectiveLocale = definition.localization.enabled
    ? (locale?.trim() ?? "") === ""
      ? definition.localization.defaultLocale
      : locale
    : undefined;

  const response = await rawApiFetch({
    method: "get",
    module: deliveryModule(definition),
    options: {
      cache: "force-cache",
      next: {
        tags: [
          contentDeliveryRedirectTag(definition.id, slug, effectiveLocale),
        ],
      },
    },
    path: `/delivery/resolve/${encodeURIComponent(slug)}`,
    pluginId,
    query:
      effectiveLocale === undefined ? undefined : { locale: effectiveLocale },
  });

  if (!response.ok) return { type: "not_found" };

  const payload = (await response.json()) as ContentDeliveryResolutionResponse;

  return payload;
};

/**
 * Delivery metadata by identifier, cached under the record's delivery tag.
 *
 * The tag is the *record's*, not the slug's, which is what makes this the right
 * call for a page that already knows which record it is rendering: an edit to the
 * SEO description expires it, and an unrelated record's publish does not.
 */
export const contentDeliveryItem = async ({
  definition,
  id,
  locale,
  pluginId,
}: {
  definition: DeliverableContentTypeDefinition;
  id: number;
  locale?: string;
  pluginId: string;
}): Promise<ContentDeliveryResponse | null> => {
  const effectiveLocale = definition.localization.enabled
    ? (locale?.trim() ?? "") === ""
      ? definition.localization.defaultLocale
      : locale
    : undefined;

  const response = await rawApiFetch({
    method: "get",
    module: deliveryModule(definition),
    options: {
      cache: "force-cache",
      next: { tags: [contentDeliveryTag(definition.id, id, effectiveLocale)] },
    },
    path: `/delivery/item/${id}`,
    pluginId,
    query:
      effectiveLocale === undefined ? undefined : { locale: effectiveLocale },
  });

  if (!response.ok) return null;

  return (await response.json()) as ContentDeliveryResponse;
};

/**
 * Delivery metadata as a `generateMetadata` return value.
 *
 * ```tsx title="src/app/[locale]/articles/[slug]/page.tsx"
 * export const generateMetadata = async ({ params }) => {
 *   const { locale, slug } = await params;
 *
 *   return await contentDeliveryMetadata({
 *     definition: articleContentType,
 *     locale,
 *     origin: "https://example.com",
 *     pluginId: "@vitnode/example",
 *     slug,
 *   });
 * };
 * ```
 *
 * The canonical URL is **absolute when an origin is given and relative otherwise**,
 * which is the one place delivery is opinionated: a relative `canonical` is legal
 * and resolves against the page, and an absolute one is what every SEO checker asks
 * for - so an app that knows its public origin should pass it.
 *
 * `{}` for a URL that does not resolve, rather than a throw: `generateMetadata`
 * runs alongside the page, the page is what calls `notFound()`, and a metadata
 * function that threw would replace a clean 404 with an error boundary.
 */
export const contentDeliveryMetadata = async ({
  definition,
  locale,
  origin,
  pluginId,
  slug,
}: {
  definition: DeliverableContentTypeDefinition;
  locale?: string;
  /** Turns every URL in the result absolute. Strongly recommended. */
  origin?: string;
  pluginId: string;
  slug: string;
}): Promise<ContentDeliveryNextMetadata> => {
  const resolution = await contentDeliveryResolve({
    definition,
    locale,
    pluginId,
    slug,
  });

  return resolution.type === "content"
    ? contentDeliveryToNextMetadata(resolution, { origin })
    : {};
};

/**
 * The pure half of {@link contentDeliveryMetadata}: metadata in, `Metadata` out.
 *
 * Exported separately so a page that already holds the delivery response - because
 * it fetched the record and its metadata together - can translate it without a
 * second round trip. It is also what makes the mapping unit-testable without a
 * network.
 */
export const contentDeliveryToNextMetadata = (
  metadata: ContentDeliveryResponse,
  { origin }: { origin?: string } = {},
): ContentDeliveryNextMetadata => {
  const absolute = (path: null | string): string | undefined => {
    if (path === null) return undefined;

    return origin === undefined
      ? path
      : (contentDeliveryUrl({ origin, path }) ?? undefined);
  };

  const canonical = absolute(metadata.canonicalPath);
  const languages = Object.fromEntries(
    Object.entries(metadata.hreflang.languages).flatMap(([code, path]) => {
      const href = absolute(path);

      return href === undefined ? [] : [[code, href]];
    }),
  );
  const xDefault =
    metadata.hreflang.xDefault === undefined
      ? undefined
      : absolute(metadata.hreflang.xDefault);

  return {
    ...(canonical === undefined && Object.keys(languages).length === 0
      ? {}
      : {
          alternates: {
            ...(canonical === undefined ? {} : { canonical }),
            ...(Object.keys(languages).length === 0
              ? {}
              : {
                  languages: {
                    ...languages,
                    // `x-default` is the standard's own key, so it goes in the same
                    // map rather than beside it - which is also how Next emits it.
                    ...(xDefault === undefined
                      ? {}
                      : { "x-default": xDefault }),
                  },
                }),
          },
        }),
    ...(metadata.seo.description === null
      ? {}
      : { description: metadata.seo.description }),
    ...(metadata.openGraph === null
      ? {}
      : {
          openGraph: {
            ...(metadata.openGraph.description === null
              ? {}
              : { description: metadata.openGraph.description }),
            ...(metadata.openGraph.title === null
              ? {}
              : { title: metadata.openGraph.title }),
            ...(canonical === undefined ? {} : { url: canonical }),
          },
        }),
    ...(metadata.robots === null ? {} : { robots: metadata.robots }),
    ...(metadata.seo.title === null ? {} : { title: metadata.seo.title }),
  };
};

/** One entry of a Next.js `sitemap.ts`, as that file's return type wants it. */
export interface ContentDeliveryNextSitemapEntry {
  alternates?: { languages?: Record<string, string> };
  changeFrequency?: ContentSitemapEntry["changeFrequency"];
  lastModified?: Date;
  priority?: number;
  url: string;
}

/**
 * Every public URL of one content type, in one language, as a Next sitemap.
 *
 * It pages through the delivery sitemap route until the cursor runs out, so a
 * content type with 40,000 published records is 40 requests rather than one
 * enormous response - and `maxPages` is a backstop, because an unbounded loop
 * against a paginated API is the one bug in this file that could take a site down.
 * Reaching it is reported by the return value rather than thrown, so a partial
 * sitemap is still a valid sitemap.
 *
 * Next caps a `sitemap.ts` at 50,000 URLs and splits beyond that with
 * `generateSitemaps`; `contentSitemapChunks` is the helper that decides how many
 * files that is.
 */
export const contentSitemapEntries = async ({
  definition,
  locale,
  maxPages = 100,
  origin,
  pageSize = CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
  pluginId,
}: {
  definition: DeliverableContentTypeDefinition;
  locale?: string;
  /** Backstop on the pagination loop. */
  maxPages?: number;
  /** Required: the sitemap protocol only accepts absolute URLs. */
  origin: string;
  pageSize?: number;
  pluginId: string;
}): Promise<{
  entries: ContentDeliveryNextSitemapEntry[];
  /** `true` when `maxPages` stopped the loop before the cursor ran out. */
  truncated: boolean;
}> => {
  const effectiveLocale = definition.localization.enabled
    ? (locale?.trim() ?? "") === ""
      ? definition.localization.defaultLocale
      : locale
    : undefined;

  const entries: ContentDeliveryNextSitemapEntry[] = [];
  let cursor: null | number = null;
  let truncated = false;

  for (let visited = 0; visited < maxPages; visited += 1) {
    const response = await rawApiFetch({
      method: "get",
      module: deliveryModule(definition),
      options: {
        cache: "force-cache",
        next: {
          tags: [contentDeliverySitemapTag(definition.id, effectiveLocale)],
        },
      },
      path: "/delivery/sitemap",
      pluginId,
      query: {
        ...(cursor === null ? {} : { cursor: String(cursor) }),
        ...(effectiveLocale === undefined ? {} : { locale: effectiveLocale }),
        limit: String(pageSize),
      },
    });

    if (!response.ok) break;

    const page = (await response.json()) as {
      entries: (Omit<ContentSitemapEntry, "lastModified"> & {
        lastModified: string;
      })[];
      nextCursor: null | number;
    };

    for (const entry of page.entries) {
      const url = contentDeliveryUrl({ origin, path: entry.path });
      if (url === null) continue;

      entries.push({
        ...(entry.changeFrequency === null
          ? {}
          : { changeFrequency: entry.changeFrequency }),
        lastModified: new Date(entry.lastModified),
        ...(entry.priority === null ? {} : { priority: entry.priority }),
        url,
      });
    }

    cursor = page.nextCursor;
    if (cursor === null) return { entries, truncated };
  }

  truncated = cursor !== null;

  return { entries, truncated };
};
