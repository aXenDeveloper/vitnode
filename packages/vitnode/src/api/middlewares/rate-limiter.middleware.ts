import type { Context, Next } from 'hono';

import {
  type IRateLimiterOptions,
  type RateLimiterAbstract,
  RateLimiterMemory,
} from 'rate-limiter-flexible';

const createRateLimiter = ({
  keyPrefix,
  ...options
}: {
  keyPrefix: string;
} & Omit<IRateLimiterOptions, 'keyPrefix'>): RateLimiterAbstract => {
  return new RateLimiterMemory({
    keyPrefix,
    points: options?.points ?? 20, // 20 requests
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
    const key =
      c.req.header('x-forwarded-for') ??
      c.req.raw.headers.get('x-real-ip') ??
      '127.0.0.1';

    try {
      await rateLimiter.consume(key);

      await next();
    } catch {
      return c.text('Too Many Requests', 429);
    }
  };
};
