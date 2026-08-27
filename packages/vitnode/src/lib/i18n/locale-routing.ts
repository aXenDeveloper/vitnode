import type { LocaleConfig, VitNodeI18nConfig } from "./types";

import { negotiateLocale } from "./negotiate-locale";

/**
 * Paths that never carry a locale prefix.
 *
 * `/api` is the VitNode API - a locale segment in front of it would be a
 * different URL to every client that has one hardcoded, and the API negotiates
 * its own language from the request anyway. `/admin` is the AdminCP, which is
 * behind a login and reads the operator's own preference rather than the URL:
 * prefixing it would double every admin URL for no crawler that will ever see
 * it.
 *
 * Both cover their descendants. Anything else is a public, localizable page.
 */
export const DEFAULT_IGNORED_LOCALE_PATHS = ["/admin", "/api"] as const;

/** How a locale is (or is not) written into a public URL. */
export type LocalePrefixMode = NonNullable<VitNodeI18nConfig["localePrefix"]>;

export interface LocaleRoutingConfig {
  defaultLocale: string;
  /**
   * Prefixes that opt out of locale routing entirely, with their descendants.
   * Defaults to {@link DEFAULT_IGNORED_LOCALE_PATHS}.
   */
  ignoredPaths?: readonly string[];
  /**
   * - `"as-needed"` (the default) - the default locale has no prefix, every
   *   other one does. This is the shape VitNode serves.
   * - `"always"` - every locale is prefixed, the default one included.
   * - `"never"` - no URL carries a locale; the visitor's cookie decides.
   */
  localePrefix?: LocalePrefixMode;
  locales: readonly string[];
}

/**
 * Where a locale may be read from when the URL does not carry one.
 *
 * Public URLs never consult either: see {@link LocaleRouting.resolveLocale}.
 * Both are read only on the branch that needs them, so a caller may pass
 * getters that go and find a cookie jar - on a public URL they are never
 * invoked.
 */
export interface LocaleSources {
  acceptLanguage?: null | string;
  cookieLocale?: null | string;
}

export interface LocaleRouting {
  /** Every other locale's URL for this one, for `hreflang`. */
  alternatePathnames: (
    pathname: string,
  ) => { locale: string; pathname: string }[];
  /** The one URL that should be indexed for `pathname` in `locale`. */
  canonicalPathname: (pathname: string, locale: string) => string;
  readonly defaultLocale: string;
  /** `/pl/discover` -> `/discover`. Leaves ignored and unprefixed paths alone. */
  deLocalizePathname: (pathname: string) => string;
  /** {@link deLocalizePathname}, applied to a URL's path and nothing else. */
  deLocalizeUrl: (url: URL) => URL;
  /**
   * The locale `pathname` is written in, or `undefined` when it carries none.
   * Only a prefix this configuration would itself emit counts, so under
   * `"as-needed"` the default locale's `/en/...` is not one.
   */
  extractLocaleFromPath: (pathname: string) => string | undefined;
  isSupportedLocale: (value: null | string | undefined) => value is string;
  readonly localePrefix: LocalePrefixMode;
  readonly locales: readonly string[];
  /** `/discover` + `pl` -> `/pl/discover`. Idempotent, and a no-op for `en`. */
  localizePathname: (pathname: string, locale: string) => string;
  /** {@link localizePathname}, applied to a URL's path and nothing else. */
  localizeUrl: (url: URL, locale: string) => URL;
  /**
   * Where `pathname` should permanently redirect to, or `undefined` when it is
   * already canonical.
   */
  redirectPathnameFor: (pathname: string) => string | undefined;
  /**
   * The single authoritative answer to "which language is this request in?".
   *
   * A runtime supplies whichever sources it can honour. The TanStack Start app
   * passes only `cookieLocale` on purpose - see `apps/web/src/lib/i18n/client.ts`
   * - because an `Accept-Language` answer the browser cannot reproduce is a
   * hydration mismatch waiting to happen. Both sources are kept here for a
   * runtime that has somewhere hydration-safe to put the negotiated result.
   */
  resolveLocale: (pathname: string, sources?: LocaleSources) => string;
  /** `true` for `/api`, `/api/x`, `/admin`, `/admin/x`; `false` for `/discover`. */
  shouldIgnoreLocalePath: (pathname: string) => boolean;
}

/** `/admin/` -> `/admin`, `admin` -> `/admin`. */
const normalizeIgnoredPath = (path: string): string => {
  const withSlash = path.startsWith("/") ? path : `/${path}`;

  return withSlash.length > 1 && withSlash.endsWith("/")
    ? withSlash.slice(0, -1)
    : withSlash;
};

/**
 * Locale routing, derived from one app's configuration.
 *
 * A factory rather than a module of free functions, because every rule below
 * depends on which locales the app serves and how it writes them - and the one
 * thing a routing utility must never do is decide that for itself. Nothing here
 * touches a `Request`, a cookie jar, `window` or a router: it is string in,
 * string out, which is what lets the Next.js app, the TanStack Start app, the
 * server middleware and the tests all reason about the same URLs.
 */
export const createLocaleRouting = ({
  defaultLocale,
  ignoredPaths = DEFAULT_IGNORED_LOCALE_PATHS,
  locales,
  localePrefix = "as-needed",
}: LocaleRoutingConfig): LocaleRouting => {
  const supported = new Set(locales);
  const ignored = ignoredPaths.map(normalizeIgnoredPath);

  const isSupportedLocale = (
    value: null | string | undefined,
  ): value is string => typeof value === "string" && supported.has(value);

  const shouldIgnoreLocalePath = (pathname: string): boolean =>
    ignored.some(path => pathname === path || pathname.startsWith(`${path}/`));

  /**
   * The prefix this configuration writes for `locale` - `""` when it writes
   * none. Unsupported input gets `""` rather than an invented prefix, so a
   * stale locale in a cookie degrades to the unprefixed URL instead of a 404.
   */
  const prefixFor = (locale: string): string => {
    if (localePrefix === "never" || !supported.has(locale)) return "";
    if (localePrefix === "always") return `/${locale}`;

    return locale === defaultLocale ? "" : `/${locale}`;
  };

  /**
   * Splits a leading locale segment off `pathname`, whether or not this
   * configuration would have written it.
   *
   * Deliberately more permissive than {@link extractLocaleFromPath}: a URL that
   * should have been canonicalised away - `/en/discover` under `"as-needed"` -
   * still has to be recognised, or the redirect that removes it could never be
   * computed.
   */
  const splitLocalePrefix = (
    pathname: string,
  ): { locale: string | undefined; rest: string } => {
    if (localePrefix === "never") return { locale: undefined, rest: pathname };

    const candidate = /^\/([^/]+)(?=\/|$)/.exec(pathname)?.[1];
    if (!candidate || !supported.has(candidate)) {
      return { locale: undefined, rest: pathname };
    }

    const rest = pathname.slice(candidate.length + 1);

    return { locale: candidate, rest: rest === "" ? "/" : rest };
  };

  const deLocalizePathname = (pathname: string): string => {
    if (shouldIgnoreLocalePath(pathname)) return pathname;

    return splitLocalePrefix(pathname).rest;
  };

  const extractLocaleFromPath = (pathname: string): string | undefined => {
    if (shouldIgnoreLocalePath(pathname)) return undefined;

    const { locale } = splitLocalePrefix(pathname);

    // A prefix this configuration would not have written is not a locale: under
    // `"as-needed"`, `/en/discover` is a URL to be redirected, not the English
    // page. Treating it as one would leave two indexable URLs for one page.
    return locale && prefixFor(locale) ? locale : undefined;
  };

  const localizePathname = (pathname: string, locale: string): string => {
    const base = deLocalizePathname(pathname);
    if (shouldIgnoreLocalePath(base)) return base;

    const prefix = prefixFor(locale);
    if (!prefix) return base;

    return base === "/" ? prefix : `${prefix}${base}`;
  };

  /**
   * A URL with a different path and everything else untouched.
   *
   * Returns the original object when the path is already right, so a rewrite
   * that changes nothing allocates nothing. Only `pathname` is assigned: the
   * search string keeps the order and the exact encoding the visitor sent,
   * which matters for cache keys and for links people have already shared.
   */
  const withPathname = (url: URL, pathname: string): URL => {
    if (url.pathname === pathname) return url;

    const next = new URL(url);
    next.pathname = pathname;

    return next;
  };

  const redirectPathnameFor = (pathname: string): string | undefined => {
    // Already where it belongs: an ignored path carries no prefix by
    // definition, so there is nothing to canonicalise.
    if (shouldIgnoreLocalePath(pathname)) return undefined;

    const { locale, rest } = splitLocalePrefix(pathname);

    // `/pl/admin` -> `/admin`. Ignored paths have no localized twin, and
    // serving one would split every admin URL in two.
    if (locale && shouldIgnoreLocalePath(rest)) return rest;

    const canonical = localizePathname(rest, locale ?? defaultLocale);

    return canonical === pathname ? undefined : canonical;
  };

  const resolveLocale = (
    pathname: string,
    sources: LocaleSources = {},
  ): string => {
    // A public URL says which language it is in, and nothing else gets a vote.
    // A cookie or an `Accept-Language` that could override it would mean one URL
    // serving two languages: ambiguous to a crawler, unshareable between people
    // with different browsers, and a cache key that no CDN can compute.
    if (!shouldIgnoreLocalePath(pathname) && localePrefix !== "never") {
      return extractLocaleFromPath(pathname) ?? defaultLocale;
    }

    // Read here rather than destructured in the signature above, which would
    // evaluate both on every call - including the public-URL path that returned
    // already, and including a caller whose `cookieLocale` is a getter that
    // reaches for a request that may not exist.
    const { acceptLanguage, cookieLocale } = sources;

    // Nothing in the URL to read, so the visitor's own preference decides:
    // what they last chose, then what their browser asks for, then the default.
    if (isSupportedLocale(cookieLocale)) return cookieLocale;

    return negotiateLocale(acceptLanguage, [...locales]) ?? defaultLocale;
  };

  return {
    alternatePathnames: pathname => {
      const base = deLocalizePathname(pathname);

      return locales.map(locale => ({
        locale,
        pathname: localizePathname(base, locale),
      }));
    },
    canonicalPathname: (pathname, locale) => localizePathname(pathname, locale),
    defaultLocale,
    deLocalizePathname,
    deLocalizeUrl: url => withPathname(url, deLocalizePathname(url.pathname)),
    extractLocaleFromPath,
    isSupportedLocale,
    locales,
    localePrefix,
    localizePathname,
    localizeUrl: (url, locale) =>
      withPathname(url, localizePathname(url.pathname, locale)),
    redirectPathnameFor,
    resolveLocale,
    shouldIgnoreLocalePath,
  };
};

/**
 * {@link createLocaleRouting}, fed from an app's `i18n` block.
 *
 * The locale list, the default and the prefix mode all come from the one place
 * an app already declares them, so a language added to `src/i18n.ts` starts
 * routing without a second edit. Disabled locales are dropped: a language the
 * app has switched off should 404 rather than render half-translated.
 */
export const localeRoutingFromConfig = (
  i18n: Pick<
    VitNodeI18nConfig,
    "defaultLocale" | "localePrefix" | "locales"
  > & { locales: LocaleConfig[] },
  options: { ignoredPaths?: readonly string[] } = {},
): LocaleRouting =>
  createLocaleRouting({
    defaultLocale: i18n.defaultLocale,
    ignoredPaths: options.ignoredPaths,
    locales: i18n.locales
      .filter(locale => locale.enabled !== false)
      .map(locale => locale.code),
    localePrefix: i18n.localePrefix,
  });
