import type { IRateLimiterOptions } from "rate-limiter-flexible";

/**
 * One category's limit, passed to `rate-limiter-flexible`: `points` requests
 * per `duration` seconds. A request over the limit gets `429` with
 * `Retry-After` and `X-RateLimit-Category` headers (`OPTIONS` preflights are
 * never refused). Off in development.
 */
export type RateLimiterCategoryOptions = Partial<
  Pick<
    IRateLimiterOptions,
    | "blockDuration"
    | "duration"
    | "execEvenly"
    | "execEvenlyMinDelayMs"
    | "points"
  >
>;

/**
 * Request limits per category, the API config's `rateLimiter`. Each request
 * counts against `safety` plus the categories its method and path fall in.
 * Unset categories keep their defaults.
 */
export interface RateLimiterConfig {
  /**
   * POSTs to core's sign-in, sign-up, password, email verification and passkey
   * sign-in routes. Always counted per IP. Defaults to 10 per 60 s.
   */
  auth?: RateLimiterCategoryOptions;
  /** @deprecated Moved to `rateLimiter.safety.blockDuration`. */
  blockDuration?: number;
  /**
   * POST and PATCH requests to non-admin Content Engine routes (paths with
   * `/content/` and no `/admin/`). Defaults to 20 per 60 s.
   */
  contentWrite?: RateLimiterCategoryOptions;
  /** @deprecated Moved to `rateLimiter.safety.duration`. */
  duration?: number;
  /** @deprecated Moved to `rateLimiter.safety.execEvenly`. */
  execEvenly?: boolean;
  /** @deprecated Moved to `rateLimiter.safety.execEvenlyMinDelayMs`. */
  execEvenlyMinDelayMs?: number;
  /**
   * Counts `read`, `write` and `contentWrite` per signed-in user instead of per
   * IP for requests that carry a session cookie. `safety` and `auth` stay per
   * IP. Defaults to `true`.
   */
  perUser?: boolean;
  /** @deprecated Moved to `rateLimiter.safety.points`. */
  points?: number;
  /** `GET` and `HEAD` requests. Defaults to 300 per 60 s. */
  read?: RateLimiterCategoryOptions;
  /**
   * The cap on every request, counted per IP. Defaults to 1000 per 60 s (80
   * per 60 s while the deprecated top-level options are used).
   */
  safety?: RateLimiterCategoryOptions;
  /**
   * Every request other than `GET`, `HEAD` and `OPTIONS`, except payment
   * provider webhooks, which only spend `safety`. Defaults to 60 per 60 s.
   */
  write?: RateLimiterCategoryOptions;
}

export type RateLimiterCategory =
  | "auth"
  | "contentWrite"
  | "read"
  | "safety"
  | "write";

export type ResolvedRateLimiterOptions = Pick<
  IRateLimiterOptions,
  "duration" | "points"
> &
  RateLimiterCategoryOptions;

export const RATE_LIMITER_DEFAULTS: Record<
  RateLimiterCategory,
  ResolvedRateLimiterOptions
> = {
  safety: { points: 1000, duration: 60 },
  read: { points: 300, duration: 60 },
  write: { points: 60, duration: 60 },
  auth: { points: 10, duration: 60 },
  contentWrite: { points: 20, duration: 60 },
};

export const RATE_LIMITER_KEY_PREFIXES: Record<RateLimiterCategory, string> = {
  safety: "vitnode-api-safety-rate-limiter",
  read: "vitnode-api-read-rate-limiter",
  write: "vitnode-api-write-rate-limiter",
  auth: "vitnode-api-auth-rate-limiter",
  contentWrite: "vitnode-api-content-write-rate-limiter",
};

const LEGACY_OPTION_KEYS = [
  "blockDuration",
  "duration",
  "execEvenly",
  "execEvenlyMinDelayMs",
  "points",
] as const satisfies (keyof RateLimiterCategoryOptions)[];

const LEGACY_DEFAULTS: ResolvedRateLimiterOptions = {
  points: 80,
  duration: 60,
};

export const usesLegacyRateLimiterOptions = (
  config: RateLimiterConfig | undefined,
): boolean => LEGACY_OPTION_KEYS.some(key => config?.[key] !== undefined);

const resolveCategory = (
  options: RateLimiterCategoryOptions | undefined,
  defaults: ResolvedRateLimiterOptions,
): ResolvedRateLimiterOptions => {
  const resolved: ResolvedRateLimiterOptions = {
    points: options?.points ?? defaults.points,
    duration: options?.duration ?? defaults.duration,
  };

  if (options?.blockDuration !== undefined) {
    resolved.blockDuration = options.blockDuration;
  }
  if (options?.execEvenly !== undefined) {
    resolved.execEvenly = options.execEvenly;
  }
  if (options?.execEvenlyMinDelayMs !== undefined) {
    resolved.execEvenlyMinDelayMs = options.execEvenlyMinDelayMs;
  }

  return resolved;
};

/**
 * Every category's limit, with defaults filled in.
 *
 * @throws When the deprecated top-level options and `safety` are both set.
 */
export const resolveRateLimiterConfig = (
  config: RateLimiterConfig | undefined,
): Record<RateLimiterCategory, ResolvedRateLimiterOptions> => {
  const legacy = usesLegacyRateLimiterOptions(config);

  if (legacy && config?.safety !== undefined) {
    throw new Error(
      `\`rateLimiter\` sets both the deprecated top-level options (${LEGACY_OPTION_KEYS.filter(key => config[key] !== undefined).join(", ")}) and \`rateLimiter.safety\`. They configure the same limiter - move the top-level options into \`rateLimiter.safety\`.`,
    );
  }

  return {
    safety: legacy
      ? resolveCategory(config, LEGACY_DEFAULTS)
      : resolveCategory(config?.safety, RATE_LIMITER_DEFAULTS.safety),
    read: resolveCategory(config?.read, RATE_LIMITER_DEFAULTS.read),
    write: resolveCategory(config?.write, RATE_LIMITER_DEFAULTS.write),
    auth: resolveCategory(config?.auth, RATE_LIMITER_DEFAULTS.auth),
    contentWrite: resolveCategory(
      config?.contentWrite,
      RATE_LIMITER_DEFAULTS.contentWrite,
    ),
  };
};
