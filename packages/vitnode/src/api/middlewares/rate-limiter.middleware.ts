import type { Context, Next } from "hono";

import {
  type IRateLimiterOptions,
  type RateLimiterAbstract,
  RateLimiterMemory,
} from "rate-limiter-flexible";

import { CONFIG } from "../../lib/config";

const createRateLimiter = ({
  keyPrefix,
  ...options
}: Omit<IRateLimiterOptions, "keyPrefix"> & {
  keyPrefix: string;
}): RateLimiterAbstract => {
  // TODO: Add support for Redis or other storage options

  return new RateLimiterMemory({
    keyPrefix,
    ...options,
  });
};

export const rateLimiterMiddleware = (
  options?: Omit<IRateLimiterOptions, "keyPrefix">,
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
