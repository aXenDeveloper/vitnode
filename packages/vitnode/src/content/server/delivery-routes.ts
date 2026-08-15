import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliveryService } from "./delivery-service";
import type { ContentModel } from "./model";

import { buildRoute } from "../../api/lib/route";
import { contentTypeName } from "../admin/labels";
import {
  CONTENT_DELIVERY_REDIRECT_STATUS,
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
  CONTENT_SITEMAP_MAX_URLS,
} from "../const";
import { ContentDeliveryNotEnabled } from "../errors";
import { resolveContentPublicLocale } from "../locale";
import { listContentLanguages } from "./language-resolver";

/**
 * The public delivery routes one content type with `delivery` gets.
 *
 * ```http
 * GET /api/{pluginId}/content/{publicApi.path}/delivery/resolve/{slug}
 * GET /api/{pluginId}/content/{publicApi.path}/delivery/item/{id}
 * GET /api/{pluginId}/content/{publicApi.path}/delivery/sitemap      (delivery.sitemap)
 * ```
 *
 * They exist because a frontend is very often **not** the process that holds the
 * database: VitNode's split deployment runs Next.js against a separate API, so
 * `generateMetadata`, a catch-all route and a `sitemap.xml` handler all need an
 * HTTP answer rather than a service call. A single-process install can still use
 * `model.deliveryService(c)` directly and never touch these.
 *
 * Every path begins with the static `delivery` segment, which is what makes them
 * impossible to shadow: `/{slug}` is one segment and these are two or three, so a
 * record whose slug happens to be `delivery` or `sitemap` still resolves the
 * ordinary way, whatever order the routes are registered in.
 *
 * No `adminStaffPermission` and no `/admin/` anywhere in the path - public delivery
 * resolution is exactly as public as the content it describes, and requiring a
 * session to learn a canonical URL would be requiring one to render a page.
 */
export const buildContentDeliveryRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition } = model;
  const name = contentTypeName(definition.id);
  const localized = definition.localization.enabled;

  const service = (c: Context): ContentDeliveryService => {
    const build = model.deliveryService;
    if (!build)
      throw new ContentDeliveryNotEnabled({ contentTypeId: definition.id });

    return build(c, { pluginId });
  };

  const localeQuery = localized
    ? {
        // Loose on purpose, like `publicParams.slug`: an unknown locale and a
        // malformed one are both the same "nothing here", so a stricter pattern
        // would only turn one of them into a differently-shaped 400.
        locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
      }
    : {};

  /**
   * Which language this request is for.
   *
   * The same resolution the public read routes use, for the same reason: an
   * explicit `?locale=` that names no language this install serves is a request for
   * something that does not exist, and substituting the default would announce an
   * English canonical URL under a Polish one.
   */
  const localeFor = async (c: Context) => {
    if (!localized) return { locale: undefined, source: "default" as const };

    const languages = await listContentLanguages(c);

    return resolveContentPublicLocale({
      acceptLanguage: c.req.header("accept-language"),
      available: languages
        .filter(language => language.isEnabled)
        .map(language => language.locale),
      defaultLocale: definition.localization.defaultLocale,
      explicit: c.req.query("locale"),
    });
  };

  const zodAlternate = z.object({
    locale: z.string(),
    path: z.string(),
  });

  const zodSeo = z.object({
    description: z.string().nullable(),
    title: z.string().nullable(),
  });

  const zodMetadata = z.object({
    alternates: z.array(zodAlternate),
    canonicalPath: z.string().nullable(),
    hreflang: z.object({
      languages: z.record(z.string(), z.string()),
      xDefault: z.string().optional(),
    }),
    isFallback: z.boolean(),
    // Nullable: delivery metadata is read off the public projection, so a content
    // type whose allowlist withholds `id` reports none rather than inventing one.
    itemId: z.number().int().nullable(),
    locale: z.string().nullable(),
    openGraph: zodSeo.nullable(),
    requestedLocale: z.string().nullable(),
    robots: z.object({ follow: z.boolean(), index: z.boolean() }).nullable(),
    seo: zodSeo,
  });

  /**
   * The resolution, as a discriminated union.
   *
   * Three arms rather than a nullable object with an optional `location`, because
   * the three outcomes need three different HTTP responses and a client that had to
   * infer which one it was holding would eventually redirect to `undefined`.
   *
   * Nothing internal is in it: no `languageId`, no `pluginId`, no `retiredAt`. Those
   * are storage details of `core_content_slug_history`, and a public contract that
   * carried them would be a public contract that could not change.
   */
  const zodResolution = z.discriminatedUnion("type", [
    zodMetadata.extend({ type: z.literal("content") }),
    z.object({
      location: z.string(),
      status: z.literal(CONTENT_DELIVERY_REDIRECT_STATUS),
      type: z.literal("redirect"),
    }),
    z.object({ type: z.literal("not_found") }),
  ]);

  const zodSitemapEntry = z.object({
    changeFrequency: z.string().nullable(),
    itemId: z.number().int(),
    lastModified: z.string(),
    locale: z.string().nullable(),
    path: z.string(),
    priority: z.number().nullable(),
  });

  const sitemapQuery = z.object({
    ...localeQuery,
    cursor: z.coerce.number().int().positive().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(CONTENT_SITEMAP_MAX_URLS)
      .optional(),
  });

  const resolve = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/delivery/resolve/{slug}",
      description: `Resolve one ${name} URL to its canonical form, a redirect, or nothing`,
      request: {
        params: z.object({ slug: z.string() }),
        ...(localized ? { query: z.object(localeQuery) } : {}),
      },
      responses: {
        200: {
          content: { "application/json": { schema: zodResolution } },
          description:
            "The resolution. A `not_found` is a 200 with a body, not a 404",
        },
      },
    },
    handler: async c => {
      const resolved = await localeFor(c);
      // An explicit locale naming no language this install serves resolves to
      // nothing rather than to the default - the same rule the public detail route
      // follows, and the reason a Polish URL is never answered with English.
      if (!resolved) return c.json({ type: "not_found" as const }, 200);

      const resolution = await service(c).resolveSlug(c.req.param("slug"), {
        locale: resolved.locale,
      });

      return c.json(resolution, 200);
    },
  });

  const item = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/delivery/item/{id}",
      description: `Delivery metadata for one published ${name}`,
      request: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        ...(localized ? { query: z.object(localeQuery) } : {}),
      },
      responses: {
        200: {
          content: { "application/json": { schema: zodMetadata } },
          description: `Canonical URL, alternates and SEO metadata`,
        },
        404: { description: `${name} not found` },
      },
    },
    handler: async c => {
      const resolved = await localeFor(c);
      if (!resolved) throw notFound(name);

      const id = Number(c.req.param("id"));
      const metadata = await service(c).findById(id, {
        locale: resolved.locale,
      });
      if (!metadata) throw notFound(name);

      return c.json(metadata, 200);
    },
  });

  const sitemap = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/delivery/sitemap",
      description: `One page of the ${name} sitemap`,
      request: { query: sitemapQuery },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                entries: z.array(zodSitemapEntry),
                nextCursor: z.number().int().nullable(),
              }),
            },
          },
          description: `Up to ${CONTENT_SITEMAP_MAX_URLS} public URLs, oldest record first`,
        },
        400: { description: "Invalid query parameters" },
      },
    },
    handler: async c => {
      const { cursor, limit } = sitemapQuery.parse(c.req.query());
      const resolved = await localeFor(c);
      if (!resolved) return c.json({ entries: [], nextCursor: null }, 200);

      const page = await service(c).sitemap({
        cursor,
        limit: limit ?? CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
        locale: resolved.locale,
      });

      return c.json(
        {
          // ISO strings rather than `Date`s, because this crosses a wire: the
          // OpenAPI schema says `string` and the runtime has to agree with it.
          entries: page.entries.map(entry => ({
            ...entry,
            lastModified: entry.lastModified.toISOString(),
          })),
          nextCursor: page.nextCursor,
        },
        200,
      );
    },
  });

  return [
    resolve,
    item,
    ...(definition.delivery.sitemap.enabled ? [sitemap] : []),
  ];
};

const notFound = (singular: string): HTTPException =>
  new HTTPException(404, { message: `${singular} not found.` });
