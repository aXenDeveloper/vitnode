import type { PageCacheStorageKind } from "@vitnode/api/page-cache/config";
import type {
  PageCacheInvalidationMode,
  PageCacheStore,
} from "@vitnode/api/page-cache/store.server";

import {
  configurePageCacheStore,
  latestPageCacheInvalidation,
  PAGE_CACHE_CLOCK_SKEW_MS,
  pageCacheRuntime,
  pageCacheStoreFor,
} from "@vitnode/api/page-cache/store.server";

/** How long a completed generation of one child sitemap may be served. */
export const SEO_SITEMAP_TTL_SECONDS = 60 * 60;

/** How long the index is kept: shorter than the files it lists. */
export const SEO_SITEMAP_INDEX_TTL_SECONDS = 10 * 60;

/** How long an unfinished generation's progress is kept. */
export const SEO_SITEMAP_BUILD_TTL_SECONDS = 15 * 60;

/**
 * Where generated sitemaps live, and when their data was last invalidated.
 * Internal: the default reads the page cache's store, so sitemap XML is
 * shared (Redis) or local (memory) exactly as cached pages are, and the
 * content invalidations that expire pages reach it too.
 */
export interface SeoSitemapCache {
  /** In ms. While in the future, nothing cached may be served. */
  bypassUntil: () => number;
  delete: (key: string) => Promise<void>;
  /** Registers the store, so invalidations reach it before the first read. */
  ensure: () => void;
  get: <T>(key: string) => Promise<null | T>;
  /** The latest invalidation of any of `tags` in one mode, in ms, or `0`. */
  invalidatedAt: (
    tags: readonly string[],
    mode: PageCacheInvalidationMode,
  ) => Promise<number>;
  set: (key: string, value: unknown, ttlSeconds: number) => Promise<void>;
}

/** `fresh` serves; `stale` serves while a refresh runs; `invalid` never serves. */
export type SeoCachedState = "fresh" | "invalid" | "stale";

/**
 * Whether data read at `startedAt` is still good. A hard invalidation within
 * the clock-skew allowance of it counts as after it, so a read that raced a
 * hidden record is never trusted.
 */
export const seoCachedState = async (
  cache: SeoSitemapCache,
  tags: readonly string[],
  startedAt: number,
): Promise<SeoCachedState> => {
  if (cache.bypassUntil() > Date.now()) return "invalid";
  if (tags.length === 0) return "fresh";

  const [hard, soft] = await Promise.all([
    cache.invalidatedAt(tags, "hard"),
    cache.invalidatedAt(tags, "soft"),
  ]);
  if (hard >= startedAt - PAGE_CACHE_CLOCK_SKEW_MS) return "invalid";
  if (soft >= startedAt - PAGE_CACHE_CLOCK_SKEW_MS) return "stale";

  return "fresh";
};

const PREFIX = "seo:";

/** The invalidation stamps must outlive anything stored. */
const LONGEST_LIFETIME =
  SEO_SITEMAP_TTL_SECONDS * 2 +
  SEO_SITEMAP_INDEX_TTL_SECONDS +
  SEO_SITEMAP_BUILD_TTL_SECONDS;

let warnedFallback = false;

/**
 * The process's page cache store, registered by `withPageCache` - or, when
 * the page cache is off, one opened here from `pageCache.storage` and
 * registered the same way, so `invalidatePageCacheTags` still reaches the
 * sitemaps. Read per call: a dev server can register a new store at any time.
 */
const runtimeStore = (storage: PageCacheStorageKind): PageCacheStore => {
  const runtime = pageCacheRuntime();
  if (runtime) {
    if (runtime.maxLifetime < LONGEST_LIFETIME) {
      runtime.maxLifetime = LONGEST_LIFETIME;
    }

    return runtime.store;
  }

  let store = pageCacheStoreFor(storage);
  if (store === null) {
    if (!warnedFallback) {
      warnedFallback = true;
      // oxlint-disable-next-line no-console
      console.error(
        `[vitnode seo] pageCache.storage is "${storage}" but REDIS_URL is not set, so sitemaps are cached in this process only.`,
      );
    }
    store = pageCacheStoreFor("memory");
  }
  if (store === null) throw new Error("No sitemap cache store.");
  configurePageCacheStore(store, { maxLifetime: LONGEST_LIFETIME });

  return store;
};

export const createSeoSitemapCache = (
  storage: PageCacheStorageKind,
): SeoSitemapCache => ({
  bypassUntil: () => pageCacheRuntime()?.bypassUntil ?? 0,
  delete: async key => {
    await runtimeStore(storage).entries.set(`${PREFIX}${key}`, null);
  },
  ensure: () => {
    runtimeStore(storage);
  },
  get: async <T>(key: string) =>
    await runtimeStore(storage).entries.get<T>(`${PREFIX}${key}`),
  invalidatedAt: async (tags, mode) =>
    await latestPageCacheInvalidation(runtimeStore(storage), tags, mode),
  set: async (key, value, ttlSeconds) => {
    await runtimeStore(storage).entries.set(`${PREFIX}${key}`, value, {
      ttl: Math.max(1, Math.ceil(ttlSeconds)),
    });
  },
});
