import { Redis } from "ioredis";

import type { CacheConfig } from "./cache";

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
