import type { Context, Next } from 'hono';

import {
  type IRateLimiterOptions,
  type RateLimiterAbstract,
  RateLimiterMemory,
} from 'rate-limiter-flexible';

import { CONFIG } from '../../lib/config';

const createRateLimiter = ({
  keyPrefix,
  ...options
}: Omit<IRateLimiterOptions, 'keyPrefix'> & {
  keyPrefix: string;
}): RateLimiterAbstract => {
  // TODO: Add support for Redis or other storage options

  return new RateLimiterMemory({
    keyPrefix,
    points: CONFIG.node_development ? 120 : (options?.points ?? 80), // 120 req in dev, 80 in prod
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
