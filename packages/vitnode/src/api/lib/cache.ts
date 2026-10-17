import type { Context } from "hono";
import type { RedisClientOptions, RedisClientType } from "redis";

/** Connection options accepted by `redis` - `url` plus any client option. */
export type CacheConfig = RedisClientOptions;

/** The connected `node-redis` client shared by the cache, rate limiter and ws. */
export type CacheClient = RedisClientType;

const CACHE_PREFIX = "vitnode:cache:";
const SYSTEM_NAMESPACE = "__system__";

export class CacheModel {
  constructor(client: CacheClient | null, c: Context) {
    this.c = c;
    this.client = client;
  }

  protected readonly c: Context;
  protected readonly client: CacheClient | null;

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

  private async readKey<T>(fullKey: string): Promise<null | T> {
    if (!this.client) return null;

    try {
      const raw = await this.client.get(fullKey);

      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  private async removeKeys(fullKeys: string[]): Promise<void> {
    if (!this.client) return;

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
    if (!this.client) return;

    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(fullKey, raw, {
          expiration: { type: "EX", value: ttlSeconds },
        });
      } else {
        await this.client.set(fullKey, raw);
      }
    } catch {
      /* caching must never break the request */
    }
  }

  /**
   * Acquire a short-lived distributed lock (`SET key val NX EX ttl`) in the
   * system namespace. Returns `true` when the lock is held by this caller.
   * **Without Redis it returns `true`** so cache-less / single-instance
   * deployments still make progress - callers must guard correctness some other
   * way (e.g. Postgres `FOR UPDATE SKIP LOCKED`). Returns `false` on a Redis
   * error so a flaky connection skips rather than double-runs work.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return true;

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
   * the order asked - one round trip however many keys. `null` without Redis or
   * on an error, which callers must not read as "none".
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

  /** Remove one or more keys. No-op without Redis. */
  async delete(key: string | string[]): Promise<void> {
    const keys = (Array.isArray(key) ? key : [key]).map(k => this.key(k));
    await this.removeKeys(keys);
  }

  /**
   * Remove one or more keys from the framework system namespace. No-op without
   * Redis. See {@link SYSTEM_NAMESPACE}.
   */
  async deleteSystem(key: string | string[]): Promise<void> {
    const keys = (Array.isArray(key) ? key : [key]).map(k => this.systemKey(k));
    await this.removeKeys(keys);
  }

  /**
   * Delete every cache key for the current plugin
   * (`vitnode:cache:{plugin_code}:*`). Other plugins' keys and unrelated Redis
   * data are left untouched. No-op without Redis.
   */
  async flush(): Promise<void> {
    if (!this.client) return;

    try {
      // `scanIterator` yields a batch of keys per SCAN round-trip.
      const scan = this.client.scanIterator({
        MATCH: `${this.prefix()}*`,
        COUNT: 100,
      });

      for await (const keys of scan) {
        if (keys.length > 0) await this.client.del(keys);
      }
    } catch {
      /* swallow */
    }
  }

  /** Read a JSON value. Returns `null` on a miss, without Redis, or on error. */
  async get<T>(key: string): Promise<null | T> {
    return this.readKey<T>(this.key(key));
  }

  async getSystem<T>(key: string): Promise<null | T> {
    return this.readKey<T>(this.systemKey(key));
  }

  /** Whether a key currently exists. `false` without Redis or on error. */
  async has(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      return (await this.client.exists(this.key(key))) === 1;
    } catch {
      return false;
    }
  }

  /** Whether a Redis client is configured at all, connected or not. */
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

  /** Release a lock taken with {@link acquireLock}. No-op without Redis. */
  async releaseLock(key: string): Promise<void> {
    await this.removeKeys([this.systemKey(`lock:${key}`)]);
  }

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
   * nothing. `false` without Redis or on an error.
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

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.writeKey(this.key(key), value, ttlSeconds);
  }

  async setSystem<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.writeKey(this.systemKey(key), value, ttlSeconds);
  }

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
