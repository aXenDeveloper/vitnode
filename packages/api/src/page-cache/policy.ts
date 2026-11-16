/**
 * How long a server-rendered page's HTML may be reused, in seconds.
 *
 * `maxAge` is the fresh window: every request inside it gets the stored HTML.
 * `staleWhileRevalidate` is a finite window after that, in which one request
 * may still get the previous HTML while a fresh render runs in the background.
 * Once both have passed, the next request waits for a new render.
 */
export interface PageCachePolicy {
  maxAge: number;
  staleWhileRevalidate?: number;
}

/** What a route or a host override may say: a policy, or `false` for none. */
export type PageCacheSetting = false | PageCachePolicy;

/** Where a route's effective policy came from. */
export type PageCachePolicySource = "host" | "route";

/** One page route with the policy that actually applies to it. */
export interface PageCacheRoute {
  maxAge?: number;
  /** Canonical VitNode path, `/blog/:slug`. */
  path: string;
  staleWhileRevalidate?: number;
}

/** The generated table the runtime matches requests against. */
export type PageCacheRouteTable = readonly PageCacheRoute[];

/** A year. Anything longer is a typo, not a cache lifetime. */
export const PAGE_CACHE_MAX_SECONDS = 31_536_000;

export class PageCachePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageCachePolicyError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWholeSeconds = (value: unknown, min: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= PAGE_CACHE_MAX_SECONDS;

/**
 * A declared `cache` value, checked. `undefined` means "not declared".
 *
 * Durations are whole seconds, so `maxAge: 300` reads the same here, in the
 * build report and in the docs.
 */
export const readPageCacheSetting = (
  value: unknown,
  where: string,
): PageCacheSetting | undefined => {
  if (value === undefined) return undefined;
  if (value === false) return false;

  if (!isRecord(value)) {
    throw new PageCachePolicyError(
      `${where} declares \`cache\` as ${JSON.stringify(value)}. Use \`false\` or \`{ maxAge: 300, staleWhileRevalidate: 60 }\` (seconds).`,
    );
  }

  const unknown = Object.keys(value).filter(
    key => key !== "maxAge" && key !== "staleWhileRevalidate",
  );
  if (unknown.length > 0) {
    throw new PageCachePolicyError(
      `${where} declares unknown \`cache\` option${unknown.length === 1 ? "" : "s"} ${unknown.map(key => `\`${key}\``).join(", ")}. A page cache policy has \`maxAge\` and \`staleWhileRevalidate\`.`,
    );
  }

  if (!isWholeSeconds(value.maxAge, 1)) {
    throw new PageCachePolicyError(
      `${where} declares \`cache.maxAge\` as ${JSON.stringify(value.maxAge)}. It is required and must be a whole number of seconds from 1 to ${String(PAGE_CACHE_MAX_SECONDS)}.`,
    );
  }

  if (
    value.staleWhileRevalidate !== undefined &&
    !isWholeSeconds(value.staleWhileRevalidate, 0)
  ) {
    throw new PageCachePolicyError(
      `${where} declares \`cache.staleWhileRevalidate\` as ${JSON.stringify(value.staleWhileRevalidate)}. It must be a whole number of seconds from 0 to ${String(PAGE_CACHE_MAX_SECONDS)} - the stale window is always finite.`,
    );
  }

  return value.staleWhileRevalidate === undefined ||
    value.staleWhileRevalidate === 0
    ? { maxAge: value.maxAge }
    : {
        maxAge: value.maxAge,
        staleWhileRevalidate: value.staleWhileRevalidate,
      };
};

/** `300` → `5m`, `90` → `1m 30s`, `7200` → `2h`. */
export const formatPageCacheDuration = (seconds: number): string => {
  const units: [number, string][] = [
    [86_400, "d"],
    [3_600, "h"],
    [60, "m"],
    [1, "s"],
  ];
  const parts: string[] = [];
  let rest = seconds;

  for (const [size, label] of units) {
    if (rest < size) continue;

    parts.push(`${String(Math.floor(rest / size))}${label}`);
    rest %= size;
    if (parts.length === 2) break;
  }

  return parts.length === 0 ? "0s" : parts.join(" ");
};

/** `TTL 5m · SWR 1m`, the one spelling the CLI and the docs share. */
export const formatPageCachePolicy = (policy: PageCachePolicy): string =>
  [
    `TTL ${formatPageCacheDuration(policy.maxAge)}`,
    ...(policy.staleWhileRevalidate
      ? [`SWR ${formatPageCacheDuration(policy.staleWhileRevalidate)}`]
      : []),
  ].join(" · ");

/** The longest time any entry of this table can be served, in seconds. */
export const longestPageCacheLifetime = (routes: PageCacheRouteTable): number =>
  Math.max(
    0,
    ...routes.map(
      route => (route.maxAge ?? 0) + (route.staleWhileRevalidate ?? 0),
    ),
  );
