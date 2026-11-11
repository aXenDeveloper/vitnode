import type { Context } from "hono";
import type { RedisClientOptions, RedisClientType } from "redis";
import type { z } from "zod";

import type { CacheEntryDefinition } from "./cache-entry";
import type { MemoryCacheStore } from "./cache-memory";

import {
  cacheEntryKey,
  cacheEntryPrefix,
  CacheEntryValidationError,
} from "./cache-entry";
import { MEMORY_CACHE_MAX_TTL_SECONDS } from "./cache-memory";
import { parseJsonWire } from "./json-wire";

/**
 * Connection options accepted by `redis` - `url` plus any client option of
 * node-redis `createClient`. The API config's `redis`.
 */
export type CacheConfig = RedisClientOptions;

/** The connected `node-redis` client shared by the cache, rate limiter and ws. */
export type CacheClient = RedisClientType;

const CACHE_PREFIX = "vitnode:cache:";
const SYSTEM_NAMESPACE = "__system__";

/** Escapes Redis `MATCH` glob characters, so a prefix matches only itself. */
const escapeGlob = (value: string): string =>
  value.replaceAll(/[*?[\]\\]/g, "\\$&");

/**
 * One typed cache entry, as `c.get("cache").entry(definition, ...keyArgs)`
 * returns it. Values are validated by the definition's schema on every write
 * and read; a stored value the schema rejects, or that is not JSON, is a miss.
 */
export interface CacheEntryHandle<Schema extends z.ZodType> {
  /** Removes the entry. No-op without a store or on error. */
  readonly delete: () => Promise<void>;
  /**
   * The schema's output, or `undefined` on a miss: nothing stored, no store,
   * a store error, or a stored value the schema rejects (which is deleted).
   * A stored `null`, `false`, `0` or `""` is a hit.
   */
  readonly get: () => Promise<undefined | z.output<Schema>>;
  /** The storage key, for logs and debugging. */
  readonly key: string;
  /**
   * The cached value on a hit; on a miss, runs `loader`, validates and stores
   * its result for the definition's TTL, and returns it. Both paths return
   * the schema's output.
   *
   * @throws {CacheEntryValidationError} When `loader`'s result is not JSON or
   * the schema rejects it. Nothing is stored.
   */
  readonly remember: (
    loader: () => Promise<z.input<Schema>> | z.input<Schema>,
  ) => Promise<z.output<Schema>>;
  /**
   * Validates `value` and stores it for the definition's TTL. A store error
   * is swallowed, like every other cache write.
   *
   * @throws {CacheEntryValidationError} When `value` is not JSON or the schema
   * rejects it. Nothing is stored.
   */
  readonly set: (value: z.input<Schema>) => Promise<void>;
  /**
   * Stores `value` only when no valid value is stored, atomically (`SET NX`
   * in Redis, the same check in the in-memory store), and resolves to the
   * value that is current afterwards: the stored one, or `value` when it was
   * written. Use it to initialise a generation stamp, so a delayed
   * initialiser cannot overwrite a stamp a writer has already moved. Without
   * a store, or when the store fails, it resolves to `value` without storing
   * it.
   *
   * @throws {CacheEntryValidationError} When `value` is not JSON or the schema
   * rejects it. Nothing is stored.
   */
  readonly setIfMissing: (value: z.input<Schema>) => Promise<z.output<Schema>>;
}

/**
 * The cache a plugin gets from `c.get("cache")`: typed entries and a
 * plugin-scoped flush, nothing else. Declare an entry with `defineCacheEntry`
 * from the plugin's `@/api/builders`, then read and write it through
 * {@link DomainCache.entry}. Values are stored as JSON and validated by the
 * entry's schema on every write and read.
 *
 * Backed by Redis when the API config has `redis` (the starter apps pass
 * `REDIS_URL`); without it, by a process-wide in-memory store (TTLs capped at
 * 15 seconds, single instance only). With neither, every read misses and every
 * write is a no-op. Redis errors are swallowed: caching never fails a request.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * import { defineCacheEntry } from "@/api/builders";
 *
 * export const latestPostsCache = defineCacheEntry({
 *   name: "latest-posts",
 *   version: 1,
 *   key: (locale: string) => [locale],
 *   schema: z.array(z.object({ id: z.number().int(), title: z.string() })),
 *   ttlSeconds: 60,
 * });
 *
 * const posts = await c
 *   .get("cache")
 *   .entry(latestPostsCache, locale)
 *   .remember(async () => await loadLatestPosts(c, locale));
 * // after a write:
 * await c.get("cache").entry(latestPostsCache, locale).delete();
 * ```
 */
export interface DomainCache {
  /**
   * A typed cache entry with its key built from `keyArgs`. Stored under the
   * plugin that defined it (`vitnode:cache-entry:{pluginId}:`), whichever
   * plugin the current request belongs to, so plugins cannot read or clobber
   * each other's values.
   *
   * @throws {CacheEntryDefinitionError} When a key part is not a short
   * string, a finite number or a boolean.
   */
  readonly entry: <Args extends readonly unknown[], Schema extends z.ZodType>(
    definition: CacheEntryDefinition<string, string, Args, Schema>,
    ...keyArgs: Args
  ) => CacheEntryHandle<Schema>;
  /**
   * Maintenance: deletes every typed entry of the current request's plugin.
   * Other plugins' entries and VitNode's own infrastructure keys are left
   * untouched, and so is everything when the request has no plugin.
   */
  readonly flush: () => Promise<void>;
}

/**
 * VitNode core's cache store behind `c.get("cache")`: the typed entries plus
 * infrastructure with its own semantics - distributed locks, lease sets, the
 * system JSON store used by sessions, staff permission sets, invalidation
 * stamps and the Content Engine's public reads, and connection status.
 *
 * Internal to core. Plugins get the narrow {@link DomainCache}; core code
 * reaches this store with {@link cacheStore}. The module is importable through
 * the package's `./*` export like any other file, but it is not a supported
 * plugin API and may change in any release.
 *
 * @internal
 */
export class CacheModel {
  constructor(
    client: CacheClient | null,
    c: Context,
    memory: MemoryCacheStore | null = null,
  ) {
    this.c = c;
    this.client = client;
    this.memory = client ? null : memory;
  }

  protected readonly c: Context;
  protected readonly client: CacheClient | null;
  protected readonly memory: MemoryCacheStore | null;

  private async putKey<T>(
    fullKey: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const raw = JSON.stringify(value);
    if (!this.client) {
      this.memory?.set(fullKey, raw, ttlSeconds);

      return;
    }
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(fullKey, raw, {
        expiration: { type: "EX", value: ttlSeconds },
      });
    } else {
      await this.client.set(fullKey, raw);
    }
  }

  /**
   * `SET NX` with a TTL: `true` when written, `false` when the key exists,
   * `null` without a store or on a store error.
   */
  private async putKeyIfAbsent(
    fullKey: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean | null> {
    const raw = JSON.stringify(value);
    if (!this.client) {
      return (
        this.memory?.setIfAbsent(
          fullKey,
          raw,
          Math.min(ttlSeconds, MEMORY_CACHE_MAX_TTL_SECONDS),
        ) ?? null
      );
    }

    try {
      const result = await this.client.set(fullKey, raw, {
        condition: "NX",
        expiration: { type: "EX", value: ttlSeconds },
      });

      return result === "OK";
    } catch {
      return null;
    }
  }

  private async readKey<T>(fullKey: string): Promise<null | T> {
    try {
      const raw = this.client
        ? await this.client.get(fullKey)
        : (this.memory?.get(fullKey) ?? null);

      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  private async readKeys<T>(fullKeys: string[]): Promise<(null | T)[]> {
    if (fullKeys.length === 0) return [];

    try {
      const raws = this.client
        ? await this.client.mGet(fullKeys)
        : fullKeys.map(key => this.memory?.get(key) ?? null);

      return raws.map(raw =>
        typeof raw === "string" ? (JSON.parse(raw) as T) : null,
      );
    } catch {
      return fullKeys.map(() => null);
    }
  }

  private async readRaw(fullKey: string): Promise<null | string> {
    try {
      return this.client
        ? await this.client.get(fullKey)
        : (this.memory?.get(fullKey) ?? null);
    } catch {
      return null;
    }
  }

  private async removeKeys(fullKeys: string[]): Promise<void> {
    if (!this.client) {
      this.memory?.delete(fullKeys);

      return;
    }

    try {
      if (fullKeys.length > 0) await this.client.del(fullKeys);
    } catch {
      /* swallow */
    }
  }

  private systemKey(key: string): string {
    return `${CACHE_PREFIX}${SYSTEM_NAMESPACE}:${key}`;
  }

  private async writeKey<T>(
    fullKey: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      await this.putKey(fullKey, value, ttlSeconds);
    } catch {
      /* caching must never break the request */
    }
  }

  /**
   * Acquire a short-lived distributed lock (`SET key val NX EX ttl`) in the
   * system namespace. Returns `true` when the lock is held by this caller.
   * **Without Redis the lock is only process-wide** (and with no store at all
   * it always returns `true`), so multi-instance deployments still make
   * progress - callers must guard correctness some other way (e.g. Postgres
   * `FOR UPDATE SKIP LOCKED`). Returns `false` on a Redis error so a flaky
   * connection skips rather than double-runs work.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return (
        this.memory?.setIfAbsent(
          this.systemKey(`lock:${key}`),
          "1",
          ttlSeconds,
        ) ?? true
      );
    }

    try {
      const result = await this.client.set(this.systemKey(`lock:${key}`), "1", {
        condition: "NX",
        expiration: { type: "EX", value: ttlSeconds },
      });

      return result === "OK";
    } catch {
      return false;
    }
  }

  /**
   * How many unexpired leases each lease set in the system namespace holds, in
   * the order asked - one round trip however many keys. Redis only: lease sets
   * must be shared by every instance, so the in-memory store never holds them.
   * `null` without Redis or on an error, which callers must not read as "none".
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async countLeases(keys: string[]): Promise<null | number[]> {
    if (!this.client) return null;
    if (keys.length === 0) return [];

    try {
      const now = Date.now();
      const client = this.client;

      // Issued in one tick, so node-redis sends them as a single pipeline.
      return await Promise.all(
        keys.map(
          async key => await client.zCount(this.systemKey(key), now, "+inf"),
        ),
      );
    } catch {
      return null;
    }
  }

  /**
   * Removes one or more keys from the system store, the framework namespace
   * shared by every plugin. No-op without a store or on error.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async deleteSystem(key: string | string[]): Promise<void> {
    const keys = (Array.isArray(key) ? key : [key]).map(k => this.systemKey(k));
    await this.removeKeys(keys);
  }

  /**
   * A typed cache entry ({@link CacheEntryDefinition}), with its key built
   * from `keyArgs`. Stored under the plugin that defined it, whichever plugin
   * the current request belongs to.
   *
   * @throws {CacheEntryDefinitionError} When a key part is not a short
   * string, a finite number or a boolean.
   *
   * @example
   * ```ts
   * const stats = await c
   *   .get("cache")
   *   .entry(forumStatsCache, forumId)
   *   .remember(async () => await countForumStats(c, forumId));
   * // after a write:
   * await c.get("cache").entry(forumStatsCache, forumId).delete();
   * ```
   */
  entry<Args extends readonly unknown[], Schema extends z.ZodType>(
    definition: CacheEntryDefinition<string, string, Args, Schema>,
    ...keyArgs: Args
  ): CacheEntryHandle<Schema> {
    const fullKey = cacheEntryKey(definition, definition.key(...keyArgs));
    const label = `${definition.pluginId}:${definition.name}`;

    const read = async (): Promise<
      { hit: false } | { hit: true; value: z.output<Schema> }
    > => {
      const raw = await this.readRaw(fullKey);
      if (raw === null) return { hit: false };

      let stored: unknown;
      try {
        stored = JSON.parse(raw);
      } catch {
        await this.removeKeys([fullKey]);

        return { hit: false };
      }
      const parsed = await definition.schema.safeParseAsync(stored);
      if (!parsed.success) {
        await this.removeKeys([fullKey]);

        return { hit: false };
      }

      return { hit: true, value: parsed.data };
    };

    const write = async (value: unknown): Promise<z.output<Schema>> => {
      const parsed = await parseJsonWire(definition.schema, value, "value");
      if (!parsed.success) {
        throw new CacheEntryValidationError(label, parsed.reason);
      }
      await this.writeKey(fullKey, parsed.wire, definition.ttlSeconds);

      return parsed.data;
    };

    return {
      delete: async () => {
        await this.removeKeys([fullKey]);
      },
      get: async () => {
        const result = await read();

        return result.hit ? result.value : undefined;
      },
      key: fullKey,
      remember: async loader => {
        const result = await read();
        if (result.hit) return result.value;

        return await write(await loader());
      },
      set: async value => {
        await write(value);
      },
      setIfMissing: async value => {
        const parsed = await parseJsonWire(definition.schema, value, "value");
        if (!parsed.success) {
          throw new CacheEntryValidationError(label, parsed.reason);
        }

        for (let attempt = 0; attempt < 2; attempt++) {
          const claimed = await this.putKeyIfAbsent(
            fullKey,
            parsed.wire,
            definition.ttlSeconds,
          );
          if (claimed !== false) return parsed.data;

          const current = await read();
          if (current.hit) return current.value;
        }

        return parsed.data;
      },
    };
  }

  /**
   * Deletes every typed entry of the current request's plugin
   * (`vitnode:cache-entry:{pluginId}:*`), plus the keys the removed string API
   * left under `vitnode:cache:{pluginId}:*`. Other plugins' entries, the
   * system store and unrelated Redis data are left untouched, and so is
   * everything when the context has no plugin. Errors are swallowed.
   */
  async flush(): Promise<void> {
    const pluginId = this.c.get("plugin")?.id;
    if (!pluginId) return;
    const prefixes = [
      cacheEntryPrefix(pluginId),
      `${CACHE_PREFIX}${pluginId}:`,
    ];

    if (!this.client) {
      for (const prefix of prefixes) this.memory?.deleteByPrefix(prefix);

      return;
    }

    try {
      for (const prefix of prefixes) {
        // `scanIterator` yields a batch of keys per SCAN round-trip.
        const scan = this.client.scanIterator({
          MATCH: `${escapeGlob(prefix)}*`,
          COUNT: 100,
        });

        for await (const keys of scan) {
          if (keys.length > 0) await this.client.del(keys);
        }
      }
    } catch {
      /* swallow */
    }
  }

  /**
   * Reads a JSON value from the system store, the framework namespace shared
   * by every plugin. `null` on a miss, without a store, or on error. The value
   * is not validated: the caller owns its shape.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async getSystem<T>(key: string): Promise<null | T> {
    return this.readKey<T>(this.systemKey(key));
  }

  /**
   * Reads several system-store keys in one round trip (`MGET`), in order.
   * Each slot is `null` on a miss; every slot is `null` on error.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async getSystemMany<T>(keys: string[]): Promise<(null | T)[]> {
    return this.readKeys<T>(keys.map(key => this.systemKey(key)));
  }

  /**
   * Whether Redis is configured at all, connected or not. The in-memory
   * fallback does not count - it is not shared between instances.
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Drop members from a lease set in the system namespace. No-op without Redis.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async releaseLeases(key: string, members: string[]): Promise<void> {
    if (!this.client || members.length === 0) return;

    try {
      await this.client.zRem(this.systemKey(key), members);
    } catch {
      /* the lease expires on its own */
    }
  }

  /**
   * Release a lock taken with {@link acquireLock}.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async releaseLock(key: string): Promise<void> {
    await this.removeKeys([this.systemKey(`lock:${key}`)]);
  }

  /**
   * Renew one member's lease in a lease set in the system namespace - a sorted
   * set scored by expiry, so every member expires on its own and concurrent
   * renewals of different members never overwrite each other. Expired members
   * are swept on the way, and the key itself outlives its newest lease by
   * nothing. Redis only, like {@link countLeases}: `false` without Redis or
   * on an error.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async renewLease(
    key: string,
    member: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      const now = Date.now();
      const fullKey = this.systemKey(key);

      await Promise.all([
        this.client.zAdd(fullKey, {
          score: now + ttlSeconds * 1000,
          value: member,
        }),
        this.client.zRemRangeByScore(fullKey, "-inf", now),
        this.client.expire(fullKey, ttlSeconds),
      ]);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stores a JSON value in the system store, the framework namespace shared
   * by every plugin. Omit `ttlSeconds` (or pass `0`) to keep it until deleted.
   * A failed write is swallowed unless `strict`, which rethrows it - for an
   * invalidation stamp, whose caller has to know it did not land so it can
   * retry rather than leave readers on the old generation.
   *
   * @internal VitNode core infrastructure; plugins use `entry()`.
   */
  async setSystem<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    { strict = false }: { strict?: boolean } = {},
  ): Promise<void> {
    const fullKey = this.systemKey(key);
    if (strict) {
      await this.putKey(fullKey, value, ttlSeconds);

      return;
    }
    await this.writeKey(fullKey, value, ttlSeconds);
  }

  /** Whether Redis is configured, and whether it answers a `PING` right now. */
  async status(): Promise<{ configured: boolean; connected: boolean }> {
    if (!this.client) return { configured: false, connected: false };

    try {
      const pong = await this.client.ping();

      return { configured: true, connected: pong === "PONG" };
    } catch {
      return { configured: true, connected: false };
    }
  }
}

const domainCaches = new WeakMap<object, CacheModel>();

/**
 * Wraps a store in the {@link DomainCache} facade the global middleware puts
 * on `c.get("cache")`. The facade has only `entry` and `flush` at runtime too,
 * and shares the store's client and memory store.
 *
 * @internal
 */
export const domainCacheOf = (store: CacheModel): DomainCache => {
  const facade: DomainCache = Object.freeze({
    entry: <Args extends readonly unknown[], Schema extends z.ZodType>(
      definition: CacheEntryDefinition<string, string, Args, Schema>,
      ...keyArgs: Args
    ) => store.entry(definition, ...keyArgs),
    flush: async () => {
      await store.flush();
    },
  });
  domainCaches.set(facade, store);

  return facade;
};

/**
 * The core cache store behind the request's `c.get("cache")`, or `undefined`
 * when the context has none (some test contexts). A context whose `cache` is
 * a store itself, as test helpers set it, resolves to that store.
 *
 * @internal
 */
export const findCacheStore = (c: Context): CacheModel | undefined => {
  const cache: unknown = c.get("cache");
  if (cache instanceof CacheModel) return cache;

  return typeof cache === "object" && cache !== null
    ? domainCaches.get(cache)
    : undefined;
};

/**
 * The core cache store behind the request's `c.get("cache")`, for VitNode
 * core infrastructure: sessions, staff permission sets, invalidation stamps,
 * locks and lease sets. Not a plugin API - plugins use `c.get("cache").entry()`.
 *
 * @throws {Error} When the context has no cache, i.e. outside VitNode's
 * global middleware.
 * @internal
 */
export const cacheStore = (c: Context): CacheModel => {
  const store = findCacheStore(c);
  if (!store) {
    throw new Error(
      "No VitNode cache store on this context - is the global middleware mounted?",
    );
  }

  return store;
};
