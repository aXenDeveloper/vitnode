import type { Context, Next } from "hono";

import {
  type IRateLimiterOptions,
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  type RateLimiterRes,
} from "rate-limiter-flexible";

import type { CacheClient } from "@/api/lib/cache";

import { CONFIG } from "../../lib/config";

const createRateLimiter = ({
  keyPrefix,
  storeClient,
  ...options
}: Omit<IRateLimiterOptions, "keyPrefix"> & {
  keyPrefix: string;
  storeClient?: CacheClient | null;
}): RateLimiterAbstract => {
  // With a Redis client the counters are shared across all instances, so rate
  // limits hold up behind a load balancer. `insuranceLimiter` falls back to
  // in-memory limiting if Redis becomes unavailable, so requests keep flowing.
  if (storeClient) {
    return new RateLimiterRedis({
      storeClient,
      // `rate-limiter-flexible` sniffs the client library from the store
      // client's constructor name, which node-redis does not expose. Without
      // this it assumes ioredis and calls a command that doesn't exist.
      useRedisPackage: true,
      keyPrefix,
      ...options,
      insuranceLimiter: new RateLimiterMemory({ keyPrefix, ...options }),
    });
  }

  return new RateLimiterMemory({
    keyPrefix,
    ...options,
  });
};

export const rateLimiterMiddleware = (
  options?: Omit<IRateLimiterOptions, "keyPrefix">,
  storeClient?: CacheClient | null,
) => {
  if (CONFIG.node_development) {
    // In development, we disable the rate limiter for easier testing
    return async (_c: Context, next: Next) => {
      await next();
    };
  }

  const duration = options?.duration ?? 60;

  const rateLimiter = createRateLimiter({
    ...options,
    keyPrefix: "vitnode-api-rate-limiter",
    duration,
    points: options?.points ?? 80,
    storeClient,
  });

  return async (c: Context, next: Next) => {
    const key = c.get("ipAddress");

    try {
      await rateLimiter.consume(key);
    } catch (rejection) {
      // `rate-limiter-flexible` rejects with a `RateLimiterRes` carrying
      // `msBeforeNext` when the limit is hit. Reply with JSON (not plain text)
      // so clients that expect a JSON body don't choke while parsing, and
      // advertise when to retry via the standard `Retry-After` header.
      const msBeforeNext = (rejection as RateLimiterRes | undefined)
        ?.msBeforeNext;
      const retryAfter = Math.ceil((msBeforeNext ?? duration * 1000) / 1000);
      c.header("Retry-After", `${retryAfter}`);

      return c.json({ error: "Too Many Requests", retryAfter }, 429);
    }

    await next();
  };
};
