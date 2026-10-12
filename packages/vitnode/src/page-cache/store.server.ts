import type { StorageInterface } from "ocache";

import { createMemoryStorage } from "ocache";

import type { CacheClient } from "../api/lib/cache";
import type { PageCacheStorageKind } from "./config";

import { createCacheClient } from "../api/lib/cache-client";

/**
 * - `"soft"`: the content changed and a stale copy is acceptable for a moment.
 *   Matching pages are treated as expired: within their stale window one more
 *   visitor may get the previous HTML while a fresh render runs.
 * - `"hard"`: the content must stop being served now - it was hidden, deleted,
 *   unpublished or moved. Matching pages are never served again, and a render
 *   that started before the invalidation is never stored.
 */
export type PageCacheInvalidationMode = "hard" | "soft";

export type PageCacheInvalidationResult =
  | { error: unknown; status: "failed" }
  | { status: "done" }
  | { status: "not-configured" };

/** Where cached pages and invalidation timestamps live. */
export interface PageCacheStore {
  /** Cached HTML responses. */
  entries: StorageInterface;
  kind: PageCacheStorageKind;
  /** When each tag was last invalidated. Kept apart so HTML cannot evict it. */
  tags: StorageInterface;
}

/**
 * How far apart two servers' clocks may be. A render that started this long
 * before an invalidation still counts as before it, so it is never stored.
 */
export const PAGE_CACHE_CLOCK_SKEW_MS = 2_000;

const MEMORY_ENTRIES_BYTES = 64 * 1024 * 1024;
const MEMORY_TAGS_COUNT = 100_000;

/** Per process: fast, but every instance has its own copy and a restart empties it. */
export const createMemoryPageCacheStore = (): PageCacheStore => ({
  entries: createMemoryStorage({ maxBytes: MEMORY_ENTRIES_BYTES }),
  kind: "memory",
  tags: createMemoryStorage({ maxSize: MEMORY_TAGS_COUNT }),
});

const REDIS_PREFIX = "vitnode:page-cache:";

const redisStorage = (
  client: CacheClient,
  namespace: string,
): StorageInterface => ({
  get: async <T>(key: string): Promise<null | T> => {
    const raw = await client.get(`${REDIS_PREFIX}${namespace}:${key}`);

    return raw === null ? null : (JSON.parse(raw) as T);
  },
  set: async (key, value, opts) => {
    const fullKey = `${REDIS_PREFIX}${namespace}:${key}`;

    if (value === null || value === undefined) {
      await client.del(fullKey);

      return;
    }

    const raw = JSON.stringify(value);
    if (opts?.ttl !== undefined && opts.ttl > 0) {
      await client.set(fullKey, raw, {
        expiration: { type: "EX", value: Math.ceil(opts.ttl) },
      });
    } else {
      await client.set(fullKey, raw);
    }
  },
});

/** Shared by every instance and survives restarts. */
export const createRedisPageCacheStore = (url: string): PageCacheStore => {
  const client = createCacheClient({ url });
  if (client === null) throw new Error("Redis client could not be created.");

  return {
    entries: redisStorage(client, "entries"),
    kind: "redis",
    tags: redisStorage(client, "tags"),
  };
};

interface PageCacheRuntime {
  /** This process serves nothing from the cache until then, in ms. */
  bypassUntil: number;
  /** The longest an entry may be served, in seconds. */
  maxLifetime: number;
  store: PageCacheStore;
}

const RUNTIME_KEY = Symbol.for("vitnode.page-cache.runtime");

type RuntimeHolder = typeof globalThis & {
  [RUNTIME_KEY]?: PageCacheRuntime;
};

/**
 * Registers the store this process caches pages in, so the API - which runs
 * in the same process in a VitNode app - can invalidate them after a write.
 */
export const configurePageCacheStore = (
  store: PageCacheStore,
  { maxLifetime }: { maxLifetime: number },
): void => {
  (globalThis as RuntimeHolder)[RUNTIME_KEY] = {
    bypassUntil: 0,
    maxLifetime,
    store,
  };
};

export const pageCacheRuntime = (): PageCacheRuntime | undefined =>
  (globalThis as RuntimeHolder)[RUNTIME_KEY];

/** Forgets the configured store. For tests. */
export const resetPageCacheStore = (): void => {
  delete (globalThis as RuntimeHolder)[RUNTIME_KEY];
};

/** The store for a storage kind, or `null` when it cannot be used here. */
export const pageCacheStoreFor = (
  kind: PageCacheStorageKind,
  env: Record<string, string | undefined> = process.env,
): null | PageCacheStore => {
  if (kind === "memory") return createMemoryPageCacheStore();

  const url = env.REDIS_URL;
  if (!url) return null;

  return createRedisPageCacheStore(url);
};

const tagKey = (tag: string, mode: PageCacheInvalidationMode): string =>
  `${mode}:${encodeURIComponent(tag)}`;

/** The latest invalidation of any of `tags` in one mode, in ms, or `0`. */
export const latestPageCacheInvalidation = async (
  store: PageCacheStore,
  tags: readonly string[],
  mode: PageCacheInvalidationMode,
): Promise<number> => {
  const stamps = await Promise.all(
    tags.map(async tag => await store.tags.get<number>(tagKey(tag, mode))),
  );

  return Math.max(0, ...stamps.map(stamp => stamp ?? 0));
};

/**
 * Invalidates every cached page that read any of `tags`.
 *
 * Writes one timestamp per tag rather than deleting entries: a page is stored
 * with the tags it read and the time its render started, and the cache compares
 * the two whenever it reads or writes that page. That is what stops a render
 * started before this call from storing what it read afterwards, on any server
 * sharing the store.
 *
 * Never claims a removal it did not make. When the store cannot be written,
 * this process stops serving cached pages for their longest lifetime - the
 * only entries it can vouch for are none - and the failure is returned for the
 * caller to report or retry. Other servers sharing the store cannot be told.
 */
export const invalidatePageCacheTags = async (
  tags: readonly string[],
  { mode }: { mode: PageCacheInvalidationMode },
): Promise<PageCacheInvalidationResult> => {
  const runtime = pageCacheRuntime();
  if (runtime === undefined) return { status: "not-configured" };

  const unique = [...new Set(tags)].filter(tag => tag.length > 0);
  if (unique.length === 0) return { status: "done" };

  const now = Date.now();
  // Longer than any entry can live, plus the skew allowance - after that no
  // stored page can predate the invalidation, so the timestamp has done its job.
  const ttl =
    runtime.maxLifetime + Math.ceil(PAGE_CACHE_CLOCK_SKEW_MS / 1000) + 60;

  try {
    await Promise.all(
      unique.map(
        async tag =>
          await runtime.store.tags.set(tagKey(tag, mode), now, { ttl }),
      ),
    );

    return { status: "done" };
  } catch (error) {
    runtime.bypassUntil = now + runtime.maxLifetime * 1000;

    return { error, status: "failed" };
  }
};
