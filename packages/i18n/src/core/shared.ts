/**
 * Configuration and pure helpers shared by the client and the server.
 *
 * Nothing here may import an environment-specific module: both `./client` and
 * `./server` pull this file in, so a `node:*` or a `window` reference would
 * leak into whichever bundle it does not belong to.
 */

export const defaultLocale = "en";
export const supportedLocales = ["en", "pl"] as const;
export const LOCALE_COOKIE = "locale";

/**
 * Formatting time zone.
 *
 * Pinned rather than left to the environment: `use-intl` would otherwise fall
 * back to the host's zone, which differs between the server and the browser and
 * makes every formatted date a hydration mismatch waiting to happen.
 */
export const defaultTimeZone = "UTC";

/** `/api/*` and `/admin/*` are never localized - they read the cookie. */
export const ignoredPathsRegex = /^\/(?:api|admin)(?:\/|$)/;

export type Locale = (typeof supportedLocales)[number];

export const isValidLocale = (locale: string | undefined): locale is Locale =>
  locale !== undefined &&
  (supportedLocales as readonly string[]).includes(locale);

export const shouldIgnorePath = (pathname: string): boolean =>
  ignoredPathsRegex.test(pathname);

/**
 * The locale a pathname carries as its first segment, or `null` when it carries
 * none.
 *
 * The default locale is deliberately reported as `null`: it is served without a
 * prefix, so `/en/about` is not a canonical URL and gets redirected rather than
 * treated as English.
 */
export const extractLocaleFromPath = (pathname: string): Locale | null => {
  const segment = pathname.split("/")[1];

  if (!isValidLocale(segment) || segment === defaultLocale) return null;

  return segment;
};

/** Drops the leading locale segment, keeping the result rooted at `/`. */
export const stripLocaleSegment = (
  pathname: string,
  locale: string,
): string => {
  const rest = pathname.slice(locale.length + 1);

  return rest === "" ? "/" : rest;
};
