import "@tanstack/react-start/server-only";
import type { LocaleConfig } from "@vitnode/api/lib/i18n/types";

import { CONTENT_REVALIDATE_PATH } from "@vitnode/api/content/server/revalidate-bridge";
import { executionContextOf } from "@vitnode/api/lib/after-response";
import { CONFIG } from "@vitnode/api/lib/config";
import { localeRoutingFromConfig } from "@vitnode/api/lib/i18n/locale-routing";
import { resolvePageCacheConfig } from "@vitnode/api/page-cache/config";

import type { VitNodeServerConfig } from "@/vitnode.config";

import type { SeoSitemapCache } from "./cache.server";
import type { SeoContentSitemapFetch } from "./content-transport.server";
import type { SeoSitemapManifest } from "./manifest";
import type {
  SeoBackground,
  SeoSitemapListSource,
  SeoSitemapResult,
} from "./sitemap.server";

import { createSeoSitemapCache } from "./cache.server";
import { createContentSitemapFetch } from "./content-transport.server";
import {
  isHtmlResponse,
  withNoIndexDocument,
  withNoIndexHeader,
} from "./html.server";
import { parseSeoSitemapChildPath } from "./manifest";
import { resolveSeoPolicy, trustedOriginFor } from "./policy.server";
import { handleContentRevalidation } from "./revalidate.server";
import { seoRobotsTxt } from "./robots.server";
import { createSeoSitemapEngine } from "./sitemap.server";

export type { SeoContentSitemapSource, SeoSitemapManifest } from "./manifest";
export { SeoConfigError } from "./policy.server";
export type {
  SeoSitemapAlternate,
  SeoSitemapListSource,
  SeoSitemapUrl,
} from "./sitemap.server";
export type {
  VitNodeSeoConfig,
  VitNodeSeoCrawlerPair,
  VitNodeSeoCrawlersConfig,
  VitNodeSeoSitemapConfig,
} from "./types";

/** The server entry's request handler, as `withPageCache` passes it on. */
export type SeoRender = (
  request: Request,
  ...rest: never[]
) => Promise<Response> | Response;

export interface SeoHandlerOptions<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /**
   * The app's `vitNodeServerConfig`. `seo` is read from it - left out, the
   * handler passes every request through untouched - along with `i18n` and
   * `pageCache.storage` from the shared config.
   */
  config: VitNodeServerConfig<AppLocales>;
  /** `sitemapManifest` from the generated `src/sitemap-sources.gen.ts`. */
  sitemap: SeoSitemapManifest;
  /**
   * App-owned URL lists beyond `seo.sitemap.paths` - the app's own docs, for
   * example - each published as `/sitemap-{id}-{n}.xml`. Keep them to
   * canonical, public, indexable pages. Defaults to none.
   */
  sources?: readonly SeoSitemapListSource[];
}

/**
 * Seams for tests and unusual deployments. Not part of the public contract.
 *
 * @internal
 */
export interface SeoHandlerInternals {
  cache?: SeoSitemapCache;
  fetchPage?: SeoContentSitemapFetch;
  /** Replaces `VITNODE_WEB_URL`. */
  webOrigin?: string;
}

const ROBOTS_CACHE_CONTROL = "public, max-age=300";

const log = (message: string, error?: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(`[vitnode seo] ${message}`, error ?? "");
};

const isReadMethod = (method: string): boolean =>
  method === "GET" || method === "HEAD";

const textResponse = (
  request: Request,
  body: string,
  status: number,
  headers: Record<string, string>,
): Response =>
  new Response(request.method === "HEAD" ? null : body, {
    headers: {
      ...headers,
      "content-length": String(new TextEncoder().encode(body).byteLength),
    },
    status,
  });

const sitemapResponse = (
  request: Request,
  result: SeoSitemapResult,
): Response => {
  if (result.status === 404) {
    return textResponse(request, "Not Found\n", 404, {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    });
  }
  if (result.status === 503) {
    return textResponse(request, "Sitemap temporarily unavailable\n", 503, {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "retry-after": "60",
    });
  }

  const headers = {
    // Caches must ask again: a record that left the public site leaves the
    // sitemap at once, not when a downstream copy expires.
    "cache-control": "no-cache",
    "content-type": "application/xml; charset=utf-8",
    etag: result.etag,
  };
  const match = request.headers.get("if-none-match");
  if (
    match !== null &&
    match.split(",").some(tag => tag.trim() === result.etag)
  ) {
    return new Response(null, { headers, status: 304 });
  }

  return textResponse(request, result.xml, 200, headers);
};

const backgroundFor = (request: Request): SeoBackground => {
  const executionCtx = executionContextOf(request);

  return task => {
    const running = task().catch((error: unknown) => {
      log("A background sitemap refresh failed.", error);
    });
    executionCtx?.waitUntil(running);
  };
};

/**
 * Wraps a server entry's `fetch` with the site's SEO policy, from
 * `buildServerConfig({ seo })`. See `withSeo` for what it serves.
 *
 * @throws {SeoConfigError} When `seo` is invalid - at startup, not per request.
 */
export const createSeoHandler = <AppLocales extends LocaleConfig[]>(
  render: SeoRender,
  { config, sitemap, sources = [] }: SeoHandlerOptions<AppLocales>,
  internals: SeoHandlerInternals = {},
): SeoRender => {
  const { i18n, pageCache } = config.config;
  const policy = resolveSeoPolicy(config.seo, {
    locales: i18n.locales.map(locale => locale.code),
  });
  if (policy === null) {
    return async (request, ...rest) => await render(request, ...rest);
  }

  const routing = localeRoutingFromConfig(i18n);
  const cache =
    internals.cache ??
    createSeoSitemapCache(resolvePageCacheConfig(pageCache).storage);
  const engine = policy.sitemap.enabled
    ? createSeoSitemapEngine({
        cache,
        fetchPage:
          internals.fetchPage ??
          createContentSitemapFetch({
            localTransport: async request => await render(request),
          }),
        listSources: sources,
        manifest: sitemap,
        policy,
        routing,
      })
    : null;
  const webOriginOf = (): string =>
    internals.webOrigin === undefined
      ? CONFIG.web.origin
      : new URL(internals.webOrigin).origin;

  return async (request, ...rest) => {
    const url = new URL(request.url);
    const { pathname } = url;

    if (isReadMethod(request.method)) {
      if (pathname === "/robots.txt") {
        const webOrigin = webOriginOf();

        return textResponse(
          request,
          seoRobotsTxt({
            origin: trustedOriginFor(url, routing, webOrigin),
            policy,
            routing,
            webOrigin,
          }),
          200,
          {
            "cache-control": ROBOTS_CACHE_CONTROL,
            "content-type": "text/plain; charset=utf-8",
          },
        );
      }

      const child = parseSeoSitemapChildPath(pathname);
      if (pathname === "/sitemap.xml" || child !== null) {
        if (engine === null) return sitemapResponse(request, { status: 404 });

        const webOrigin = webOriginOf();
        const origin = trustedOriginFor(url, routing, webOrigin);
        const background = backgroundFor(request);
        const result =
          child === null
            ? await engine.index({ background, origin, webOrigin })
            : await engine.child({
                background,
                file: child.file,
                origin,
                part: child.part,
                webOrigin,
              });

        return sitemapResponse(request, result);
      }
    }

    if (pathname === CONTENT_REVALIDATE_PATH && request.method === "POST") {
      return await handleContentRevalidation(request, cache.ensure);
    }

    const response = await render(request, ...rest);
    if (policy.indexing || !isHtmlResponse(response)) return response;

    // Prerendered pages are served as files, past this handler, so the
    // directive goes into the document itself as well.
    return request.headers.has("x-nitro-prerender")
      ? await withNoIndexDocument(response)
      : withNoIndexHeader(response);
  };
};

/** A TanStack Start server entry, as `withPageCache` returns it. */
export interface SeoServerEntry {
  fetch: (request: Request, ...rest: never[]) => Promise<Response> | Response;
}

/**
 * Applies `buildServerConfig({ seo })` to every response. Compose it outside
 * `withPageCache`, so the policy also reaches pages served from the HTML
 * cache. With `seo` left out it changes nothing. Server-only.
 *
 * - `/robots.txt`: `User-agent: *` with the AdminCP and account settings
 *   excluded (every locale's path), one group per configured bot, and an
 *   absolute `Sitemap:` line while the sitemap is published. Generated from
 *   config alone - no API, session or database.
 * - `/sitemap.xml`: a sitemap index of `/sitemap-{file}-{n}.xml` children -
 *   `seo.sitemap.paths`, the `sources` given here, and every content type
 *   with `delivery.sitemap`, read as a guest. Cached with the page cache's
 *   store and expired by content changes. `404` while the sitemap is off,
 *   `503` while no complete generation can be served.
 * - `indexing: false`: `X-Robots-Tag: noindex` on HTML responses, and a robots
 *   `<meta>` in prerendered pages.
 * - `POST /api/vitnode/content/revalidate`: expires sitemap files when a
 *   separate API lists this site in `content.revalidateOrigins`.
 *
 * URLs only ever use configured origins: `VITNODE_WEB_URL`, or an
 * `i18n.domains` origin when the request is for that host.
 *
 * @throws {SeoConfigError} When `seo` is invalid.
 *
 * @example
 * ```ts
 * // src/server.ts
 * import handler from "@tanstack/react-start/server-entry";
 * import { withPageCache } from "@vitnode/core/tanstack/page-cache/server";
 * import { withSeo } from "@vitnode/core/tanstack/seo/server";
 *
 * import { pageCacheBuildId, pageCacheRoutes } from "@/page-cache.gen";
 * import { sitemapManifest } from "@/sitemap-sources.gen";
 * import { vitNodeConfig } from "@/vitnode.config";
 * import { vitNodeServerConfig } from "@/vitnode.server.config";
 *
 * export default withSeo(
 *   withPageCache(handler, {
 *     buildId: pageCacheBuildId,
 *     config: vitNodeConfig,
 *     routes: pageCacheRoutes,
 *   }),
 *   { config: vitNodeServerConfig, sitemap: sitemapManifest },
 * );
 * ```
 */
export const withSeo = <AppLocales extends LocaleConfig[]>(
  entry: SeoServerEntry,
  options: SeoHandlerOptions<AppLocales>,
): SeoServerEntry => {
  const fetch = createSeoHandler(
    async (request, ...rest) => await entry.fetch(request, ...rest),
    options,
  );

  return { fetch: async (request, ...rest) => await fetch(request, ...rest) };
};
