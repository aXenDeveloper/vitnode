import "@tanstack/react-start/server-only";
import type { CachedEventHandler, HTTPEvent, ResponseCacheEntry } from "ocache";

import { defineCachedHandler } from "ocache";

import type { LocaleConfig } from "@/lib/i18n/types";
import type { PageCacheStore } from "@/page-cache/store.server";
import type { VitNodeConfig } from "@/vitnode.config";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";
import { resolvePageCacheConfig } from "@/page-cache/config";
import { createPageCacheMatcher } from "@/page-cache/match";
import { longestPageCacheLifetime } from "@/page-cache/policy";
import { runPageCacheRender } from "@/page-cache/render-context.server";
import {
  configurePageCacheStore,
  latestPageCacheInvalidation,
  PAGE_CACHE_CLOCK_SKEW_MS,
  pageCacheRuntime,
  pageCacheStoreFor,
} from "@/page-cache/store.server";
import {
  decodePageCacheTags,
  encodePageCacheTags,
  PAGE_CACHE_RENDER_HEADER,
  PAGE_CACHE_STATUS_HEADER,
} from "@/page-cache/tags";

import type { PageCacheRouteTable } from "../../page-cache/policy";

import { handleLocaleRequest } from "../i18n/request";
import { DOCUMENT_CACHE_CONTROL } from "../start/document-headers";

/**
 * Query parameters that only ever feed analytics. They are dropped from the
 * cache key and from the request the page renders, so they cannot change it.
 * Any other parameter - a preview token included - skips the cache.
 */
export const PAGE_CACHE_IGNORED_QUERY_PARAMS: ReadonlySet<string> = new Set([
  "_ga",
  "_gl",
  "dclid",
  "fbclid",
  "gbraid",
  "gclid",
  "igshid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ttclid",
  "twclid",
  "utm_campaign",
  "utm_content",
  "utm_id",
  "utm_medium",
  "utm_source",
  "utm_term",
  "wbraid",
  "yclid",
]);

/** Stored with an entry, never sent to a visitor. */
const SHAREABLE_HEADER = "x-vitnode-page-cache-shareable";
const TAGS_HEADER = "x-vitnode-page-cache-tags";
const RENDERED_AT_HEADER = "x-vitnode-page-cache-rendered-at";
/** The shared render set a cookie, which the cache layer cannot pass on. */
const SETS_COOKIE_HEADER = "x-vitnode-page-cache-sets-cookie";
const INTERNAL_HEADERS = [
  SHAREABLE_HEADER,
  TAGS_HEADER,
  RENDERED_AT_HEADER,
  SETS_COOKIE_HEADER,
];

/**
 * What a cached page tells browsers and CDNs: store it if you like, but ask
 * every time. The server answers that question with a 304 from the entry's
 * ETag, so a hard invalidation is never outlived by a copy downstream.
 */
const SHARED_DOCUMENT_CACHE_CONTROL = "no-cache";

/** The same, for a response that also sets this visitor's locale cookie. */
const PERSONAL_SHARED_DOCUMENT_CACHE_CONTROL = "private, no-cache";

const LARGEST_PAGE_BYTES = 2 * 1024 * 1024;

export type PageCacheRender = (
  request: Request,
  ...rest: never[]
) => Promise<Response> | Response;

export interface PageCacheHandlerOptions<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** `pageCacheBuildId` from `src/page-cache.gen.ts`; a new build never serves an old build's pages. */
  buildId: string;
  /** The app's `vitNodeConfig`; `pageCache` and `i18n` are read from it. */
  config: VitNodeConfig<AppLocales>;
  /** Overrides the production-only default. For tests. */
  enabled?: boolean;
  /** `pageCacheRoutes` from `src/page-cache.gen.ts`. */
  routes: PageCacheRouteTable;
  /** Overrides the store `config.pageCache.storage` names. For tests. */
  store?: PageCacheStore;
}

const log = (message: string, error?: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(`[vitnode page-cache] ${message}`, error ?? "");
};

const isHtml = (headers: Headers): boolean =>
  (headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");

const forbidsSharing = (cacheControl: null | string): boolean =>
  cacheControl !== null && /\b(?:private|no-store)\b/i.test(cacheControl);

const withoutRenderMarker = (request: Request): Request => {
  if (!request.headers.has(PAGE_CACHE_RENDER_HEADER)) return request;

  const headers = new Headers(request.headers);
  headers.delete(PAGE_CACHE_RENDER_HEADER);

  return new Request(request, { headers });
};

/** The URL a shared render is keyed on, or `null` when the query rules it out. */
const shareableUrl = (url: URL): null | URL => {
  if (url.search === "") return url;

  const keys = [...url.searchParams.keys()];
  if (keys.some(key => !PAGE_CACHE_IGNORED_QUERY_PARAMS.has(key))) return null;

  const clean = new URL(url);
  clean.search = "";

  return clean;
};

const withHeaders = (
  response: Response,
  edit: (headers: Headers) => void,
): Response => {
  const headers = new Headers(response.headers);
  edit(headers);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const stripInternal = (headers: Headers): void => {
  for (const name of INTERNAL_HEADERS) headers.delete(name);
};

const headerValue = (
  headers: Record<string, string>,
  name: string,
): string | undefined => headers[name] ?? headers[name.toLowerCase()];

/**
 * Wraps a server entry's `fetch` with VitNode's HTML response cache.
 *
 * A request is served from the cache only when every one of these holds:
 * caching is on (production, `pageCache.enabled`), it is a `GET` or `HEAD`, its
 * route has a policy in `routes`, its query string is empty or analytics only,
 * and the locale rules would not redirect it. Everything else - previews,
 * forms, API calls, the AdminCP - goes straight to `render` untouched.
 *
 * A cached page is rendered once for everybody: without cookies or credentials
 * and marked as a shared render, so the shell leaves the visitor's account UI
 * to the browser. It is stored only if that render answered `200` HTML, set no
 * cookie, and read no API response marked private. Otherwise the visitor who
 * asked gets a render of their own request instead - which is how staff still
 * see a hidden article on a cached route.
 */
export const createPageCacheHandler = <AppLocales extends LocaleConfig[]>(
  render: PageCacheRender,
  {
    buildId,
    config,
    enabled = process.env.NODE_ENV !== "development",
    routes,
    store: providedStore,
  }: PageCacheHandlerOptions<AppLocales>,
): PageCacheRender => {
  const settings = resolvePageCacheConfig(config.pageCache);
  const match = createPageCacheMatcher(routes);
  const maxLifetime = longestPageCacheLifetime(routes);

  if (!enabled || !settings.enabled || maxLifetime === 0) {
    return async (request, ...rest) =>
      await render(withoutRenderMarker(request), ...rest);
  }

  const store = providedStore ?? pageCacheStoreFor(settings.storage);
  if (store === null) {
    log(
      `pageCache.storage is "${settings.storage}" but REDIS_URL is not set, so pages are not cached. Set REDIS_URL, or use "memory".`,
    );

    return async (request, ...rest) =>
      await render(withoutRenderMarker(request), ...rest);
  }

  configurePageCacheStore(store, { maxLifetime });
  const localeRouting = localeRoutingFromConfig(config.i18n);

  const shouldCache = async (entry: ResponseCacheEntry): Promise<boolean> => {
    if (headerValue(entry.headers, SHAREABLE_HEADER) !== "1") return false;
    if ((pageCacheRuntime()?.bypassUntil ?? 0) > Date.now()) return false;

    const renderedAt = Number(headerValue(entry.headers, RENDERED_AT_HEADER));
    if (!Number.isFinite(renderedAt)) return false;

    const invalidatedAt = await latestPageCacheInvalidation(
      store,
      decodePageCacheTags(headerValue(entry.headers, TAGS_HEADER)),
      "hard",
    );

    return invalidatedAt < renderedAt - PAGE_CACHE_CLOCK_SKEW_MS;
  };

  const renderShared = async (
    event: HTTPEvent,
    rest: never[],
  ): Promise<Response> => {
    const headers = new Headers(event.req.headers);
    headers.set(PAGE_CACHE_RENDER_HEADER, "1");
    const request = new Request(event.req.url, {
      headers,
      method: event.req.method,
      signal: event.req.signal,
    });
    const state = { isPrivate: false, tags: new Set<string>() };
    const renderedAt = Date.now();
    const response = await runPageCacheRender(
      state,
      async () => await render(request, ...rest),
    );

    const isShareable =
      response.status === 200 &&
      isHtml(response.headers) &&
      !response.headers.has("set-cookie") &&
      !forbidsSharing(response.headers.get("cache-control")) &&
      !state.isPrivate;

    return withHeaders(response, out => {
      if (!isShareable) {
        out.set("cache-control", DOCUMENT_CACHE_CONTROL);
        if (response.headers.has("set-cookie"))
          out.set(SETS_COOKIE_HEADER, "1");

        return;
      }

      out.delete("cache-control");
      out.set(SHAREABLE_HEADER, "1");
      out.set(TAGS_HEADER, encodePageCacheTags(state.tags));
      out.set(RENDERED_AT_HEADER, String(renderedAt));
    });
  };

  const pending = new WeakMap<HTTPEvent, never[]>();
  const handlers = new Map<string, CachedEventHandler>();
  const handlerFor = (maxAge: number, staleWhileRevalidate: number) => {
    const key = `${String(maxAge)}:${String(staleWhileRevalidate)}`;
    const existing = handlers.get(key);
    if (existing) return existing;

    const handler = defineCachedHandler(
      async event => await renderShared(event, pending.get(event) ?? []),
      {
        cacheStatusHeader: PAGE_CACHE_STATUS_HEADER,
        group: "vitnode/pages",
        integrity: `${buildId}:${key}`,
        maxAge,
        maxBodySize: LARGEST_PAGE_BYTES,
        name: `pages:${buildId}`,
        onError: error => {
          log("Cache error; the page was rendered without it.", error);
        },
        sendCacheControl: false,
        shouldCache,
        storage: store.entries,
        ...(staleWhileRevalidate > 0
          ? { staleMaxAge: staleWhileRevalidate, swr: true }
          : { swr: false }),
      },
    );
    handlers.set(key, handler);

    return handler;
  };

  return async (incoming, ...rest) => {
    const request = withoutRenderMarker(incoming);
    const bypass = async () =>
      withHeaders(await render(request, ...rest), headers => {
        headers.set(PAGE_CACHE_STATUS_HEADER, "BYPASS");
      });

    if (request.method !== "GET" && request.method !== "HEAD") {
      return await render(request, ...rest);
    }
    if (request.headers.has("x-nitro-prerender")) {
      return await render(request, ...rest);
    }

    const url = new URL(request.url);
    const host = url.host.toLowerCase();
    const internal = localeRouting.deLocalizePathname(url.pathname, { host });
    const route = match(internal);
    if (route?.policy == null) return await render(request, ...rest);

    const cacheUrl = shareableUrl(url);
    if (cacheUrl === null) return await bypass();

    const plan = handleLocaleRequest(request, localeRouting);
    if (plan.redirect) return await render(request, ...rest);

    if ((pageCacheRuntime()?.bypassUntil ?? 0) > Date.now()) {
      return await bypass();
    }

    const handler = handlerFor(
      route.policy.maxAge,
      route.policy.staleWhileRevalidate ?? 0,
    );
    const eventFor = (): HTTPEvent => {
      const event: HTTPEvent = {
        req: Object.assign(
          new Request(cacheUrl, {
            headers: request.headers,
            method: request.method,
          }),
          { waitUntil: (incoming as { waitUntil?: unknown }).waitUntil },
        ) as HTTPEvent["req"],
      };
      pending.set(event, rest);

      return event;
    };

    let response: Response;
    try {
      response = (await handler(eventFor())) as Response;

      const renderedAt = Number(response.headers.get(RENDERED_AT_HEADER));
      if (
        response.headers.get(PAGE_CACHE_STATUS_HEADER) === "HIT" &&
        Number.isFinite(renderedAt)
      ) {
        const softAt = await latestPageCacheInvalidation(
          store,
          decodePageCacheTags(response.headers.get(TAGS_HEADER)),
          "soft",
        );

        // No skew allowance, unlike a hard invalidation: a soft one may be
        // missed by a render racing it, which then only lives out its TTL.
        if (softAt > renderedAt) {
          await response.body?.cancel();
          await handler.expire(eventFor());
          response = (await handler(eventFor())) as Response;
        }
      }
    } catch (error) {
      log("Cache unavailable; rendering without it.", error);

      return await bypass();
    }

    if (response.status === 304) {
      return withHeaders(response, headers => {
        stripInternal(headers);
        headers.set("cache-control", SHARED_DOCUMENT_CACHE_CONTROL);
      });
    }

    if (
      response.status !== 200 ||
      response.headers.get(SHAREABLE_HEADER) !== "1"
    ) {
      // Not something everybody may see. A visitor with cookies may be allowed
      // more than the public render showed - a moderator on a hidden article -
      // so they get a render of their own request. So does a page that sets a
      // cookie: the cache layer drops `set-cookie`, and the visitor needs it.
      if (
        request.headers.has("cookie") ||
        response.headers.get(SETS_COOKIE_HEADER) === "1"
      ) {
        await response.body?.cancel();

        return await bypass();
      }

      return withHeaders(response, headers => {
        stripInternal(headers);
        headers.set(PAGE_CACHE_STATUS_HEADER, "BYPASS");
        if (isHtml(headers))
          headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
      });
    }

    return withHeaders(response, headers => {
      stripInternal(headers);
      if (plan.setCookie) {
        // The locale preference this URL implies, for this visitor only. It is
        // added after the cache, so it is never stored for anyone else.
        headers.append("set-cookie", plan.setCookie);
        headers.set("cache-control", PERSONAL_SHARED_DOCUMENT_CACHE_CONTROL);
      } else {
        headers.set("cache-control", SHARED_DOCUMENT_CACHE_CONTROL);
      }
    });
  };
};

/** A TanStack Start server entry, as `@tanstack/react-start/server-entry` exports it. */
export interface StartServerEntry {
  fetch: (request: Request, ...rest: never[]) => Promise<Response> | Response;
}

/**
 * Wraps the TanStack Start server entry with VitNode's shared HTML page cache
 * (see `createPageCacheHandler` for which requests are cached and when a
 * render is stored). Only routes with a policy in `routes` - e.g. a plugin
 * `page()`'s `cache` option - are cached, only outside development, and not when
 * `pageCache.enabled` is `false`. Server-only.
 *
 * The host app's `src/server.ts`:
 *
 * ```ts
 * import handler from '@tanstack/react-start/server-entry'
 * import { withPageCache } from '@vitnode/core/tanstack/page-cache/server'
 *
 * import { pageCacheBuildId, pageCacheRoutes } from './page-cache.gen'
 * import { vitNodeConfig } from './vitnode.config'
 *
 * export default withPageCache(handler, {
 *   buildId: pageCacheBuildId,
 *   config: vitNodeConfig,
 *   routes: pageCacheRoutes,
 * })
 * ```
 */
export const withPageCache = <AppLocales extends LocaleConfig[]>(
  entry: StartServerEntry,
  options: PageCacheHandlerOptions<AppLocales>,
): StartServerEntry => {
  const fetch = createPageCacheHandler(
    async (request, ...rest) => await entry.fetch(request, ...rest),
    options,
  );

  return { fetch: async (request, ...rest) => await fetch(request, ...rest) };
};

export {
  invalidatePageCacheTags,
  type PageCacheInvalidationMode,
  type PageCacheInvalidationResult,
} from "@/page-cache/store.server";
