import type { Context, Next } from 'hono';

import {
  type IRateLimiterOptions,
  type RateLimiterAbstract,
  RateLimiterMemory,
} from 'rate-limiter-flexible';

const createRateLimiter = ({
  keyPrefix,
  ...options
}: Omit<IRateLimiterOptions, 'keyPrefix'> & {
  keyPrefix: string;
}): RateLimiterAbstract => {
  // TODO: Add support for Redis or other storage options

  return new RateLimiterMemory({
    keyPrefix,
    points: options?.points ?? 40, // 40 requests
    duration: options?.duration ?? 60, // per 60 seconds
    ...options,
  });
};

export const rateLimiterMiddleware = (
  options?: Omit<IRateLimiterOptions, 'keyPrefix'>,
) => {
  const rateLimiter = createRateLimiter({
    ...options,
    keyPrefix: 'vitnode-api-rate-limiter',
  });

  return async (c: Context, next: Next) => {
    const key = c.get('ipAddress');

    try {
      await rateLimiter.consume(key);

      await next();
    } catch {
      return c.text('Too Many Requests', 429);
    }
  };
};
