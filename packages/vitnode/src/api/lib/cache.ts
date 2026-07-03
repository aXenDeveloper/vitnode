import type { Context } from "hono";

import { Redis, type RedisOptions } from "ioredis";

export type CacheConfig = RedisOptions & { url?: string };

/**
 * Root prefix applied to every key VitNode writes, so the cache can be flushed
 * without touching unrelated data that may live in the same Redis instance.
 * Keys are further namespaced per plugin — see {@link CacheModel.prefix}.
 */
const CACHE_PREFIX = "vitnode:cache:";

/**
 * Create the shared Redis client from the app's `redis` config, or `null` when
 * Redis is not configured. Connection errors are swallowed so a missing or
 * unreachable Redis never crashes the process — every {@link CacheModel} method
 * degrades to a safe fallback instead.
 */
export const createCacheClient = (config?: CacheConfig): null | Redis => {
  if (!config) return null;

  const { url, ...options } = config;
  // `enableOfflineQueue: false` makes commands fail fast (instead of queueing)
  // when Redis is unreachable, so `remember` falls through to its loader rather
  // than hanging. Callers can override it via the config.
  const client = url
    ? new Redis(url, { enableOfflineQueue: false, ...options })
    : new Redis({ enableOfflineQueue: false, ...options });

  // Without a listener, an "error" event (e.g. Redis down) is thrown as an
  // unhandled exception and crashes the process. Swallow it here.
  client.on("error", () => {
    /* cache methods handle failures individually */
  });

  return client;
};

/**
 * A small, safe cache facade exposed on the request context as
 * `c.get("cache")`. Values are JSON-serialized and namespaced per plugin (see
 * {@link CacheModel.prefix}), so the `hello` key a plugin writes actually lives
 * at `vitnode:cache:{plugin_code}:hello`. When Redis is not configured (client
 * is `null`) or a command fails, reads return `null`/`false`, writes are
 * no-ops, and {@link CacheModel.remember} simply runs its loader — caching must
 * never break a request.
 */
export class CacheModel {
  constructor(client: null | Redis, c: Context) {
    this.c = c;
    this.client = client;
  }

  protected readonly c: Context;
  protected readonly client: null | Redis;

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

  /** Remove one or more keys. No-op without Redis. */
  async delete(key: string | string[]): Promise<void> {
    if (!this.client) return;

    try {
      const keys = (Array.isArray(key) ? key : [key]).map(k => this.key(k));
      if (keys.length > 0) await this.client.del(...keys);
    } catch {
      /* swallow */
    }
  }

  /**
   * Delete every cache key for the current plugin
   * (`vitnode:cache:{plugin_code}:*`). Other plugins' keys and unrelated Redis
   * data are left untouched. No-op without Redis.
   */
  async flush(): Promise<void> {
    if (!this.client) return;

    try {
      const stream = this.client.scanStream({
        match: `${this.prefix()}*`,
        count: 100,
      });

      for await (const keys of stream) {
        const batch = keys as string[];
        if (batch.length > 0) await this.client.del(...batch);
      }
    } catch {
      /* swallow */
    }
  }

  /** Read a JSON value. Returns `null` on a miss, without Redis, or on error. */
  async get<T>(key: string): Promise<null | T> {
    if (!this.client) return null;

    try {
      const raw = await this.client.get(this.key(key));

      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
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

  /**
   * Fetch-through cache: return the cached value for `key`, or run `loader`,
   * cache its result for `ttlSeconds`, and return it. Without Redis (or on a
   * cache error) it simply runs `loader` every time. `null` results are not
   * cached.
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
   * Write a JSON value. `ttlSeconds` sets an expiry; omit it for a value that
   * lives until explicitly deleted or flushed. No-op without Redis.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;

    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(this.key(key), raw, "EX", ttlSeconds);
      } else {
        await this.client.set(this.key(key), raw);
      }
    } catch {
      /* caching must never break the request */
    }
  }

  /**
   * Report whether Redis is wired up and reachable. `configured` is `true` when
   * a client was created from the app's `redis` config; `connected` is `true`
   * only when a `PING` round-trips. A `configured` but not `connected` result
   * means Redis is set up yet currently unreachable — the admin integrations
   * panel surfaces that as a problem.
   */
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
