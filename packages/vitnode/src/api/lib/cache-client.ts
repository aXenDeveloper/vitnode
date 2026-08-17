import { createClient } from "redis";

import type { CacheClient, CacheConfig } from "./cache";

export const createCacheClient = (config?: CacheConfig): CacheClient | null => {
  if (!config) return null;

  // `disableOfflineQueue: true` makes commands fail fast (instead of queueing)
  // when Redis is unreachable, so `remember` falls through to its loader rather
  // than hanging. Callers can override it via the config.
  const client = createClient({ disableOfflineQueue: true, ...config });

  // Without a listener, an "error" event (e.g. Redis down) is thrown as an
  // unhandled exception and crashes the process. Swallow it here.
  client.on("error", () => {
    /* cache methods handle failures individually */
  });

  // node-redis does not connect on construction. Kick the connection off here
  // and let the built-in reconnect strategy keep retrying in the background -
  // until the socket is ready every command rejects, which the cache and the
  // rate limiter already treat as "no Redis".
  void client.connect().catch(() => {
    /* the reconnect strategy keeps retrying; commands fail fast meanwhile */
  });

  return client;
};
