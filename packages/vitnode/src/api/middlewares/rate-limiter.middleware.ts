import type { Context, MiddlewareHandler } from "hono";

import { routePath } from "hono/route";
import { isIP } from "node:net";
import {
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";

import type { CacheClient } from "@/api/lib/cache";

import { CONFIG } from "../../lib/config";
import {
  RATE_LIMITER_KEY_PREFIXES,
  type RateLimiterCategory,
  type RateLimiterConfig,
  type ResolvedRateLimiterOptions,
  resolveRateLimiterConfig,
  usesLegacyRateLimiterOptions,
} from "./rate-limiter-config";

export const createRateLimiter = ({
  keyPrefix,
  storeClient,
  ...options
}: ResolvedRateLimiterOptions & {
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

const READ_METHODS = new Set(["GET", "HEAD"]);

/**
 * The limiters a request spends, in order. Anything that is not a read or a
 * preflight counts as a write, so an unusual method gets the stricter budget.
 */
export const rateLimiterCategoriesFor = (
  method: string,
  path: string,
): RateLimiterCategory[] => {
  if (method === "OPTIONS") return ["safety"];
  if (READ_METHODS.has(method)) return ["safety", "read"];

  const categories: RateLimiterCategory[] = ["safety", "write"];
  if (
    method === "POST" &&
    AUTH_RATE_LIMITED_PATHS.some(authPath => path.endsWith(authPath))
  ) {
    categories.push("auth");
  }
  if (
    (method === "POST" || method === "PATCH") &&
    path.includes("/content/") &&
    !path.includes("/admin/")
  ) {
    categories.push("contentWrite");
  }

  return categories;
};

const CATEGORY_HEADER_VALUES: Record<RateLimiterCategory, string> = {
  safety: "safety",
  read: "read",
  write: "write",
  auth: "auth",
  contentWrite: "content-write",
};

const DYNAMIC_SEGMENT =
  /^(?:\d+|[\da-f]{16,}|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/i;
const MAX_TEMPLATE_SEGMENTS = 12;

const isDynamicSegment = (segment: string): boolean =>
  DYNAMIC_SEGMENT.test(segment) ||
  segment.length > 32 ||
  /[^\w.@-]/.test(segment) ||
  (segment.length >= 8 && /\d/.test(segment) && /[a-z]/i.test(segment));

/**
 * A path with its ids, hashes, tokens and slugs swapped for `:param`, so a
 * log line names the route without naming the record or the visitor.
 */
export const rateLimitPathTemplate = (path: string): string =>
  path
    .split("/")
    .slice(0, MAX_TEMPLATE_SEGMENTS + 1)
    .map(segment => (segment && isDynamicSegment(segment) ? ":param" : segment))
    .join("/");

// The router already knows the template of a matched route. A path no route
// matched (a scanner probing `/wp-admin`) only reaches the catch-all `*`.
const requestPathTemplate = (c: Context): string => {
  const route = routePath(c, -1);

  return route && !route.includes("*")
    ? route
    : rateLimitPathTemplate(c.req.path);
};

const KNOWN_METHODS = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
]);

interface CategoryLimiter {
  category: RateLimiterCategory;
  duration: number;
  limiter: RateLimiterAbstract;
  points: number;
}

/**
 * Every limiter VitNode applies, built once. `preflight` runs before `cors()`,
 * which answers an `OPTIONS` request without calling the next middleware, and
 * spends only the `safety` budget. `requests` runs after it and skips
 * `OPTIONS`, so each request is counted once and each limiter consumed at
 * most once, stopping at the first that refuses.
 */
export const rateLimiterMiddleware = (
  config: RateLimiterConfig | undefined,
  storeClient?: CacheClient | null,
): { preflight: MiddlewareHandler; requests: MiddlewareHandler } => {
  const resolved = resolveRateLimiterConfig(config);

  if (usesLegacyRateLimiterOptions(config)) {
    // oxlint-disable-next-line no-console
    console.warn(
      `\x1b[34m[VitNode]\x1b[0m \x1b[33mDeprecated:\x1b[0m top-level \`rateLimiter\` options (points, duration, ...) now configure \`rateLimiter.safety\`, the cap on every request. Move them there.`,
    );
  }

  if (CONFIG.node_development) {
    // In development, we disable the rate limiter for easier testing
    const skip: MiddlewareHandler = async (_c, next) => {
      await next();
    };

    return { preflight: skip, requests: skip };
  }

  const store = storeClient ? "redis" : "memory";
  const build = (category: RateLimiterCategory): CategoryLimiter => ({
    category,
    duration: resolved[category].duration,
    points: resolved[category].points,
    limiter: createRateLimiter({
      ...resolved[category],
      keyPrefix: RATE_LIMITER_KEY_PREFIXES[category],
      storeClient,
    }),
  });
  const limiters: Record<RateLimiterCategory, CategoryLimiter> = {
    safety: build("safety"),
    read: build("read"),
    write: build("write"),
    auth: build("auth"),
    contentWrite: build("contentWrite"),
  };

  const reject = (
    c: Context,
    { category, duration, points }: CategoryLimiter,
    rejection: unknown,
  ) => {
    // `rate-limiter-flexible` rejects with a `RateLimiterRes` carrying
    // `msBeforeNext` when the limit is hit. Reply with JSON (not plain text)
    // so clients that expect a JSON body don't choke while parsing, and
    // advertise when to retry via the standard `Retry-After` header.
    const res = rejection instanceof RateLimiterRes ? rejection : undefined;
    const retryAfter = Math.ceil((res?.msBeforeNext ?? duration * 1000) / 1000);
    const categoryHeader = CATEGORY_HEADER_VALUES[category];

    // Only the first refusal in a window is logged, so a flood stays one line
    // per visitor per window instead of one per request.
    if (res?.consumedPoints === points + 1) {
      // oxlint-disable-next-line no-console
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mRate limit exceeded\x1b[0m: ${JSON.stringify(
          {
            category: categoryHeader,
            method: KNOWN_METHODS.has(c.req.method) ? c.req.method : "OTHER",
            path: requestPathTemplate(c),
            status: 429,
            retryAfter,
            store,
          },
        )}`,
      );
    }

    c.header("Retry-After", `${retryAfter}`);
    c.header("X-RateLimit-Category", categoryHeader);

    return c.json({ error: "Too Many Requests", retryAfter }, 429);
  };

  const consume = async (c: Context, categories: RateLimiterCategory[]) => {
    const key = rateLimitKey(c.get("ipAddress"));

    for (const category of categories) {
      try {
        await limiters[category].limiter.consume(key);
      } catch (rejection) {
        return reject(c, limiters[category], rejection);
      }
    }

    return undefined;
  };

  return {
    preflight: async (c, next) => {
      if (c.req.method === "OPTIONS") {
        const rejected = await consume(c, ["safety"]);
        if (rejected) return rejected;
      }

      await next();
    },
    requests: async (c, next) => {
      if (c.req.method !== "OPTIONS") {
        const rejected = await consume(
          c,
          rateLimiterCategoriesFor(c.req.method, c.req.path),
        );
        if (rejected) return rejected;
      }

      await next();
    },
  };
};
