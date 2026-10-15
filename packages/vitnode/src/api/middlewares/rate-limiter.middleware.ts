import type { Context, MiddlewareHandler } from "hono";

import { getCookie } from "hono/cookie";
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

/**
 * The headers a 429 carries. A cross-origin caller reads them only when CORS
 * exposes them, so `VitNodeAPI` adds these to `exposeHeaders`.
 */
export const RATE_LIMIT_RESPONSE_HEADERS = [
  "Retry-After",
  "X-RateLimit-Category",
] as const;

/**
 * An app's `exposeHeaders` with the rate limit headers added, keeping the
 * app's own entries and spelling. Header names are case-insensitive.
 */
export const exposeRateLimitHeaders = (
  exposeHeaders: readonly string[] = [],
): string[] => {
  const exposed = new Set(exposeHeaders.map(header => header.toLowerCase()));

  return [
    ...exposeHeaders,
    ...RATE_LIMIT_RESPONSE_HEADERS.filter(
      header => !exposed.has(header.toLowerCase()),
    ),
  ];
};

// Spent per signed-in member when `perUser` is on. `safety` and `auth` always
// stay per address: sign-in is anonymous, and the address cap is the one
// protection that never depends on who the caller claims to be.
const PER_USER_CATEGORIES = new Set<RateLimiterCategory>([
  "contentWrite",
  "read",
  "write",
]);

type RateLimitSubject = "ip" | "user";

interface RateLimitIdentity {
  key: string;
  subject: RateLimitSubject;
}

const ipIdentity = (c: Context): RateLimitIdentity => ({
  key: rateLimitKey(c.get("ipAddress")),
  subject: "ip",
});

// `rateLimitKey` never returns a string starting with `user:`, so a member's
// counters can share a limiter with addresses without colliding.
export const userRateLimitKey = (userId: number): string => `user:${userId}`;

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

export interface RateLimiterMiddlewareOptions {
  /** The public session cookie, to tell a member's request from a guest's. */
  sessionCookieName: string;
  storeClient?: CacheClient | null;
}

/**
 * Every limiter VitNode applies, built once, in three stages.
 *
 * - `preflight` runs before `cors()`, which answers an `OPTIONS` request
 *   without calling the next middleware. It counts the preflight against
 *   `safety` but never refuses it: a refused preflight reaches the page as an
 *   opaque network error, while the real request that follows gets a 429 that
 *   carries CORS headers and a readable `Retry-After`.
 * - `requests` runs after `cors()` and before the session is resolved. It
 *   spends `safety` and `auth` per address and, for a request with no session
 *   cookie, `read`, `write` and `contentWrite` per address too.
 * - `identified` runs after `globalMiddleware`. A request with a session
 *   cookie spends `read`, `write` and `contentWrite` here, per member when the
 *   session is valid and per address when it is not. Such a request is
 *   counted after its session lookup, so the address `safety` cap is what
 *   bounds how many lookups one address can cause.
 *
 * Each limiter is consumed at most once per request, stopping at the first
 * that refuses.
 */
export const rateLimiterMiddleware = (
  config: RateLimiterConfig | undefined,
  { sessionCookieName, storeClient }: RateLimiterMiddlewareOptions,
): {
  identified: MiddlewareHandler;
  preflight: MiddlewareHandler;
  requests: MiddlewareHandler;
} => {
  const resolved = resolveRateLimiterConfig(config);
  const perUser = config?.perUser ?? true;

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

    return { preflight: skip, requests: skip, identified: skip };
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

  const retryAfterOf = (
    { duration }: CategoryLimiter,
    res: RateLimiterRes | undefined,
  ) => Math.ceil((res?.msBeforeNext ?? duration * 1000) / 1000);

  // Only the first refusal in a window is logged, so a flood stays one line
  // per visitor per window instead of one per request. `subject` says whether
  // a member or an address ran out, never which one.
  const logFirstRefusal = (
    c: Context,
    limiter: CategoryLimiter,
    subject: RateLimitSubject,
    res: RateLimiterRes | undefined,
    status: number,
  ) => {
    if (res?.consumedPoints !== limiter.points + 1) return;

    // oxlint-disable-next-line no-console
    console.warn(
      `\x1b[34m[VitNode]\x1b[0m \x1b[33mRate limit exceeded\x1b[0m: ${JSON.stringify(
        {
          category: CATEGORY_HEADER_VALUES[limiter.category],
          subject,
          method: KNOWN_METHODS.has(c.req.method) ? c.req.method : "OTHER",
          path: requestPathTemplate(c),
          status,
          retryAfter: retryAfterOf(limiter, res),
          store,
        },
      )}`,
    );
  };

  const reject = (
    c: Context,
    limiter: CategoryLimiter,
    subject: RateLimitSubject,
    rejection: unknown,
  ) => {
    // `rate-limiter-flexible` rejects with a `RateLimiterRes` carrying
    // `msBeforeNext` when the limit is hit. Reply with JSON (not plain text)
    // so clients that expect a JSON body don't choke while parsing, and
    // advertise when to retry via the standard `Retry-After` header.
    const res = rejection instanceof RateLimiterRes ? rejection : undefined;
    const retryAfter = retryAfterOf(limiter, res);
    const [retryAfterHeader, categoryHeader] = RATE_LIMIT_RESPONSE_HEADERS;

    logFirstRefusal(c, limiter, subject, res, 429);

    c.header(retryAfterHeader, `${retryAfter}`);
    c.header(categoryHeader, CATEGORY_HEADER_VALUES[limiter.category]);

    return c.json({ error: "Too Many Requests", retryAfter }, 429);
  };

  const consume = async (
    c: Context,
    categories: RateLimiterCategory[],
    identity: RateLimitIdentity,
  ) => {
    const ip = ipIdentity(c);

    for (const category of categories) {
      const { key, subject } = PER_USER_CATEGORIES.has(category)
        ? identity
        : ip;

      try {
        await limiters[category].limiter.consume(key);
      } catch (rejection) {
        return reject(c, limiters[category], subject, rejection);
      }
    }

    return undefined;
  };

  // The same test `SessionModel.getUser` makes before it looks anything up:
  // without a non-empty cookie the request is a guest's, whatever it says.
  const carriesSession = (c: Context): boolean =>
    perUser && !!getCookie(c, sessionCookieName);

  return {
    preflight: async (c, next) => {
      if (c.req.method === "OPTIONS") {
        const limiter = limiters.safety;

        try {
          await limiter.limiter.consume(ipIdentity(c).key);
        } catch (rejection) {
          logFirstRefusal(
            c,
            limiter,
            "ip",
            rejection instanceof RateLimiterRes ? rejection : undefined,
            204,
          );
        }
      }

      await next();
    },
    requests: async (c, next) => {
      if (c.req.method !== "OPTIONS") {
        const categories = rateLimiterCategoriesFor(c.req.method, c.req.path);
        const rejected = await consume(
          c,
          carriesSession(c)
            ? categories.filter(category => !PER_USER_CATEGORIES.has(category))
            : categories,
          ipIdentity(c),
        );
        if (rejected) return rejected;
      }

      await next();
    },
    identified: async (c, next) => {
      if (c.req.method !== "OPTIONS" && carriesSession(c)) {
        const userId = c.get("user")?.id;
        const rejected = await consume(
          c,
          rateLimiterCategoriesFor(c.req.method, c.req.path).filter(category =>
            PER_USER_CATEGORIES.has(category),
          ),
          userId === undefined
            ? ipIdentity(c)
            : { key: userRateLimitKey(userId), subject: "user" },
        );
        if (rejected) return rejected;
      }

      await next();
    },
  };
};
