import type { RedisClientType } from "redis";

import { createClient } from "redis";

/**
 * Root prefix for everything the Next.js cache handlers write.
 *
 * Deliberately *not* `vitnode:cache:` - that namespace belongs to the API's
 * `c.get("cache")` and is flushed per plugin. These keys are written by the web
 * process, hold rendered output rather than domain values, and are thrown away
 * on a different schedule, so they get a namespace of their own that neither
 * side can clear by accident.
 */
export const NEXT_CACHE_PREFIX = "vitnode:next:";

/**
 * The client lives on `globalThis` because Next loads a cache handler through a
 * dynamic import that may be evaluated more than once - once per handler kind,
 * and again across the copies of a module that server bundles can produce. Each
 * evaluation must reach the same connection rather than opening its own.
 */
const CLIENT = Symbol.for("@vitnode/next-cache-client");

interface ClientRegistry {
  [CLIENT]?: null | RedisClientType;
}

/**
 * Whether Redis is configured for the web process.
 *
 * `REDIS_URL` is the switch, matching how `vitnode.api.config.ts` gates Redis on
 * the API side. A cache handler is given to Next as a **module path**, so there
 * is no way to hand it a configuration object from `next.config.ts` - the
 * environment is the only channel it has, which is why the connection is read
 * from here rather than passed in.
 */
export const isCacheRedisConfigured = (): boolean =>
  Boolean(process.env.REDIS_URL);

/**
 * The shared connection, or `null` when Redis is not configured.
 *
 * Mirrors the API's client: commands fail fast instead of queueing, errors are
 * swallowed at the socket, and the connection is opened in the background so a
 * cold start never blocks on Redis being up.
 */
export const getCacheRedis = (): null | RedisClientType => {
  const registry = globalThis as ClientRegistry;

  if (registry[CLIENT] !== undefined) return registry[CLIENT];

  const url = process.env.REDIS_URL;
  if (!url) {
    registry[CLIENT] = null;

    return null;
  }

  const client = createClient({
    url,
    ...(process.env.REDIS_PASSWORD
      ? { password: process.env.REDIS_PASSWORD }
      : {}),
    // Fail fast rather than queue, so a cache read misses and the request
    // regenerates instead of hanging on an unreachable Redis.
    disableOfflineQueue: true,
  }) as RedisClientType;

  // Without a listener an "error" event is rethrown as an unhandled exception
  // and takes the web process down. Every command already handles its own
  // failure.
  client.on("error", () => {
    /* handled per command */
  });

  void client
    .connect()
    .then(() => {
      idle(client);
    })
    .catch(() => {
      /* node-redis keeps retrying; commands fail fast until it is up */
    });

  registry[CLIENT] = client;

  return client;
};

/**
 * How many commands are waiting on Redis right now.
 *
 * An open socket is a referenced handle, which keeps the Node event loop alive.
 * That is wrong for a cache client in a process that is trying to finish -
 * `next build` loads these handlers too - and it is equally wrong to unreference
 * it permanently, because then a process with nothing else to do exits *while a
 * command is still in flight* and the write is silently lost.
 *
 * So the socket is referenced exactly while it has work: an idle client never
 * holds a process open, and a busy one always finishes what it started.
 */
let inFlight = 0;

const busy = (client: RedisClientType): void => {
  inFlight += 1;
  if (inFlight === 1) {
    try {
      client.ref();
    } catch {
      /* not connected yet; the connect handler settles the reference */
    }
  }
};

const idle = (client: RedisClientType): void => {
  if (inFlight > 0) return;

  try {
    client.unref();
  } catch {
    /* nothing to unreference */
  }
};

const settle = (client: RedisClientType): void => {
  inFlight -= 1;
  idle(client);
};

/**
 * Runs a Redis command, returning `fallback` if Redis is absent or the command
 * fails.
 *
 * Every read in both handlers goes through this. A cache that throws is worse
 * than no cache at all: a miss costs a render, an exception costs the response.
 */
export const cacheRedisRead = async <T>(
  run: (client: RedisClientType) => Promise<T>,
  fallback: T,
): Promise<T> => {
  const client = getCacheRedis();
  if (!client) return fallback;

  busy(client);
  try {
    return await run(client);
  } catch {
    return fallback;
  } finally {
    settle(client);
  }
};

/** The write half of {@link cacheRedisRead}. Failures are dropped. */
export const cacheRedisWrite = async (
  run: (client: RedisClientType) => Promise<unknown>,
): Promise<void> => {
  const client = getCacheRedis();
  if (!client) return;

  busy(client);
  try {
    await run(client);
  } catch {
    /* a dropped write is a future miss, which is survivable */
  } finally {
    settle(client);
  }
};
