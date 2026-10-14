import type { IRateLimiterOptions } from "rate-limiter-flexible";

/**
 * Tuning for one limiter. The store, the key prefix and the insurance limiter
 * are VitNode's to set, so they are not configurable here.
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

export interface RateLimiterConfig {
  /** Sign-in, sign-up, password reset and passkey sign-in. Stacks on `write`. */
  auth?: RateLimiterCategoryOptions;
  /** @deprecated Moved to `rateLimiter.safety.blockDuration`. */
  blockDuration?: number;
  /** Public Content Engine creates and edits. Stacks on `write`. */
  contentWrite?: RateLimiterCategoryOptions;
  /** @deprecated Moved to `rateLimiter.safety.duration`. */
  duration?: number;
  /** @deprecated Moved to `rateLimiter.safety.execEvenly`. */
  execEvenly?: boolean;
  /** @deprecated Moved to `rateLimiter.safety.execEvenlyMinDelayMs`. */
  execEvenlyMinDelayMs?: number;
  /** @deprecated Moved to `rateLimiter.safety.points`. */
  points?: number;
  /** `GET` and `HEAD` requests. */
  read?: RateLimiterCategoryOptions;
  /** A cap on every request, whatever its method. */
  safety?: RateLimiterCategoryOptions;
  /** Every request that is not a read or a CORS preflight. */
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

// `auth` and `contentWrite` keep their prefixes, so live Redis counters carry
// over a deploy. The old single limiter's `vitnode-api-rate-limiter` is retired
// rather than handed to `safety`: it counted a different budget, and its keys
// expire within one window.
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

// The budget the single limiter enforced on every request before categories.
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

  // Picked one by one, so nothing else on the object - a stray `keyPrefix` or
  // `storeClient` from an untyped config - reaches a limiter's constructor.
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
 * Turns `rateLimiter` into complete options for every limiter. The deprecated
 * top-level keys configured a cap on every request, which is what `safety`
 * is, so they map there with the old 80-per-minute defaults - an old config
 * keeps exactly the budget it had, and `read` and `write` apply underneath.
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
