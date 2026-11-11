import type { Context } from "hono";
import type { RedisClientOptions, RedisClientType } from "redis";
import type { z } from "zod";

import type { CacheEntryDefinition } from "./cache-entry";
import type { MemoryCacheStore } from "./cache-memory";

import {
  CACHE_ENTRY_PREFIX,
  cacheEntryKey,
  cacheEntryPrefix,
  CacheEntryValidationError,
} from "./cache-entry";
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
}

/**
 * Server-side domain cache, read in a route as `c.get("cache")`. Values are
 * stored as JSON, so dates come back as strings.
 *
 * Backed by Redis when the API config has `redis` (the starter apps pass
 * `REDIS_URL`); without it, by the process-wide {@link MemoryCacheStore} the
 * global middleware passes in (short TTLs, single-instance only - see
 * `MEMORY_CACHE_MAX_TTL_SECONDS`). With neither, every method is a no-op.
 * Redis errors are swallowed: caching never fails a request.
 *
 * Keys are prefixed with the current plugin (`vitnode:cache:{pluginId}:`), so
 * plugins cannot read or clobber each other's keys. The `*System` methods use a
 * shared framework namespace instead.
 *
 * @example
 * ```ts
 * const stats = await c.get("cache").remember("stats", 300, async () => countPosts(c));
 * // after a write:
 * await c.get("cache").delete("stats");
 * ```
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

  private key(key: string): string {
    return `${this.prefix()}${key}`;
  }

  /**
   * Key prefix for the current request's plugin, e.g.
   * `vitnode:cache:@vitnode/blog:`. Keys are scoped per plugin so one plugin
   * can't read or clobber another's cache. Falls back to the shared
   * `vitnode:cache:` namespace when there is no plugin on the context.
   */
  private prefix(): string {
    const pluginId = this.c.get("plugin")?.id;

    return pluginId ? `${CACHE_PREFIX}${pluginId}:` : CACHE_PREFIX;
  }

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

  /** Remove one or more keys. */
  async delete(key: string | string[]): Promise<void> {
    const keys = (Array.isArray(key) ? key : [key]).map(k => this.key(k));
    await this.removeKeys(keys);
  }

  /**
   * Remove one or more keys from the framework system namespace. See
   * {@link SYSTEM_NAMESPACE}.
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
    };
  }

  /**
   * Delete every cache key for the current plugin
   * (`vitnode:cache:{plugin_code}:*`), and its typed entries
   * (`vitnode:cache-entry:{plugin_code}:*`). Other plugins' keys and
   * unrelated Redis data are left untouched.
   */
  async flush(): Promise<void> {
    const pluginId = this.c.get("plugin")?.id;
    const prefixes = [
      this.prefix(),
      pluginId ? cacheEntryPrefix(pluginId) : CACHE_ENTRY_PREFIX,
    ];

    if (!this.client) {
      for (const prefix of prefixes) this.memory?.deleteByPrefix(prefix);

      return;
    }

    try {
      for (const prefix of prefixes) {
        // `scanIterator` yields a batch of keys per SCAN round-trip.
        const scan = this.client.scanIterator({
          MATCH: `${prefix}*`,
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

  /** Read a JSON value. Returns `null` on a miss, without a store, or on error. */
  async get<T>(key: string): Promise<null | T> {
    return this.readKey<T>(this.key(key));
  }

  /** {@link CacheModel.get} in the framework system namespace, shared by every plugin. */
  async getSystem<T>(key: string): Promise<null | T> {
    return this.readKey<T>(this.systemKey(key));
  }

  /**
   * Reads several system-namespace keys in one round trip (`MGET`), in order.
   * Each slot is `null` on a miss; every slot is `null` on error.
   */
  async getSystemMany<T>(keys: string[]): Promise<(null | T)[]> {
    return this.readKeys<T>(keys.map(key => this.systemKey(key)));
  }

  /** Whether a key currently exists. `false` without a store or on error. */
  async has(key: string): Promise<boolean> {
    if (!this.client) return this.memory?.has(this.key(key)) ?? false;

    try {
      return (await this.client.exists(this.key(key))) === 1;
    } catch {
      return false;
    }
  }

  /**
   * Whether Redis is configured at all, connected or not. The in-memory
   * fallback does not count - it is not shared between instances.
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Drop members from a lease set in the system namespace. No-op without Redis. */
  async releaseLeases(key: string, members: string[]): Promise<void> {
    if (!this.client || members.length === 0) return;

    try {
      await this.client.zRem(this.systemKey(key), members);
    } catch {
      /* the lease expires on its own */
    }
  }

  /** Release a lock taken with {@link acquireLock}. */
  async releaseLock(key: string): Promise<void> {
    await this.removeKeys([this.systemKey(`lock:${key}`)]);
  }

  /**
   * Returns the cached value, or runs `loader`, caches its result for
   * `ttlSeconds` and returns it. A `null` result is never served from the
   * cache, so a loader answering `null` runs every time. Without Redis it
   * always runs `loader`.
   */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await loader();
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Renew one member's lease in a lease set in the system namespace - a sorted
   * set scored by expiry, so every member expires on its own and concurrent
   * renewals of different members never overwrite each other. Expired members
   * are swept on the way, and the key itself outlives its newest lease by
   * nothing. Redis only, like {@link countLeases}: `false` without Redis or
   * on an error.
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
   * Store a JSON value. Omit `ttlSeconds` (or pass `0`) to keep it until
   * deleted. No-op without Redis or on error.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.writeKey(this.key(key), value, ttlSeconds);
  }

  /**
   * {@link CacheModel.set} in the framework system namespace, shared by every
   * plugin. `strict` rethrows a failed write instead of swallowing it - for an
   * invalidation stamp, whose caller has to know it did not land so it can
   * retry rather than leave readers on the old generation.
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
