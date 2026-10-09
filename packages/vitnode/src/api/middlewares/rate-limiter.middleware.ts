import type { Context, Next } from "hono";

import { isIP } from "node:net";
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

export const rateLimitKey = (ipAddress: string): string => {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ipAddress);
  if (mapped) return mapped[1];
  if (isIP(ipAddress) !== 6) return ipAddress;

  const [head, tail = ""] = ipAddress.toLowerCase().split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const groups = ipAddress.includes("::")
    ? [
        ...headGroups,
        ...Array<string>(8 - headGroups.length - tailGroups.length).fill("0"),
        ...tailGroups,
      ]
    : headGroups;

  return `${groups
    .slice(0, 4)
    .map(group => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
};

export const rateLimiterMiddleware = (
  options?: Partial<Omit<IRateLimiterOptions, "keyPrefix">>,
  storeClient?: CacheClient | null,
  {
    defaults = { duration: 60, points: 80 },
    keyPrefix = "vitnode-api-rate-limiter",
  }: {
    defaults?: { duration: number; points: number };
    keyPrefix?: string;
  } = {},
) => {
  if (CONFIG.node_development) {
    // In development, we disable the rate limiter for easier testing
    return async (_c: Context, next: Next) => {
      await next();
    };
  }

  const duration = options?.duration ?? defaults.duration;

  const rateLimiter = createRateLimiter({
    ...options,
    keyPrefix,
    duration,
    points: options?.points ?? defaults.points,
    storeClient,
  });

  return async (c: Context, next: Next) => {
    const key = rateLimitKey(c.get("ipAddress"));

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

const AUTH_RATE_LIMITED_PATHS = [
  "/@vitnode/core/users/sign_in",
  "/@vitnode/core/users/sign_up",
  "/@vitnode/core/users/reset-password",
  "/@vitnode/core/users/verify-email",
  "/@vitnode/core/users/verify-email/resend",
  "/@vitnode/core/users/change-password",
  "/@vitnode/core/users/passkeys/sign-in",
  "/@vitnode/core/users/passkeys/admin-sign-in",
] as const;

const isAuthRateLimitedRequest = (c: Context): boolean =>
  c.req.method === "POST" &&
  AUTH_RATE_LIMITED_PATHS.some(path => c.req.path.endsWith(path));

export const authRateLimiterMiddleware = (
  options?: Partial<Omit<IRateLimiterOptions, "keyPrefix">>,
  storeClient?: CacheClient | null,
) => {
  const limit = rateLimiterMiddleware(options, storeClient, {
    defaults: { duration: 60, points: 10 },
    keyPrefix: "vitnode-api-auth-rate-limiter",
  });

  return async (c: Context, next: Next) =>
    isAuthRateLimitedRequest(c) ? limit(c, next) : next();
};
