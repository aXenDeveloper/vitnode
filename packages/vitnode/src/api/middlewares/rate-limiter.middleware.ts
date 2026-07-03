import type { Context, Next } from "hono";
import type { Redis } from "ioredis";

import {
  type IRateLimiterOptions,
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
} from "rate-limiter-flexible";

import { CONFIG } from "../../lib/config";

const createRateLimiter = ({
  keyPrefix,
  storeClient,
  ...options
}: Omit<IRateLimiterOptions, "keyPrefix"> & {
  keyPrefix: string;
  storeClient?: null | Redis;
}): RateLimiterAbstract => {
  // With a Redis client the counters are shared across all instances, so rate
  // limits hold up behind a load balancer. `insuranceLimiter` falls back to
  // in-memory limiting if Redis becomes unavailable, so requests keep flowing.
  if (storeClient) {
    return new RateLimiterRedis({
      storeClient,
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
  storeClient?: null | Redis,
) => {
  if (CONFIG.node_development) {
    // In development, we disable the rate limiter for easier testing
    return async (_c: Context, next: Next) => {
      await next();
    };
  }

  const rateLimiter = createRateLimiter({
    ...options,
    keyPrefix: "vitnode-api-rate-limiter",
    duration: options?.duration ?? 60,
    points: options?.points ?? 80,
    storeClient,
  });

  return async (c: Context, next: Next) => {
    const key = c.get("ipAddress");

    try {
      await rateLimiter.consume(key);
    } catch {
      return c.text("Too Many Requests", 429);
    }

    await next();
  };
};
