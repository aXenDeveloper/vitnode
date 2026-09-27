import type { ResolvedLocaleDomain } from "./locale-domains";
import type { RoutePathTranslator } from "./route-paths";
import type {
  LocaleConfig,
  LocaleDomainConfig,
  LocaleRoutePaths,
  VitNodeI18nConfig,
} from "./types";

import { normalizeHost, resolveLocaleDomains } from "./locale-domains";
import { negotiateLocale } from "./negotiate-locale";
import { compileRoutePaths } from "./route-paths";

export const DEFAULT_IGNORED_LOCALE_PATHS = ["/admin", "/api"] as const;

/** How a locale is (or is not) written into a public URL. */
export type LocalePrefixMode = NonNullable<VitNodeI18nConfig["localePrefix"]>;

export interface LocaleRoutingConfig {
  defaultLocale: string;
  domains?: readonly LocaleDomainConfig[];
  /**
   * Prefixes that opt out of locale routing entirely, with their descendants.
   * Defaults to {@link DEFAULT_IGNORED_LOCALE_PATHS}.
   */
  ignoredPaths?: readonly string[];

  localePrefix?: LocalePrefixMode;
  locales: readonly string[];
  routePaths?: LocaleRoutePaths;
}

export interface LocaleSources {
  acceptLanguage?: null | string;
  cookieLocale?: null | string;
  host?: null | string;
}

export interface LocaleHostContext {
  host?: null | string;
}

export type ResolvedLocaleSource =
  "accept-language" | "cookie" | "default" | "domain" | "prefix";

export interface ResolvedPublicPathname {
  internalPathname: string;
  locale: string;
  source: ResolvedLocaleSource;
}

export interface LocalePublicUrl {
  origin?: string;
  pathname: string;
}

export interface LocaleAlternate extends LocalePublicUrl {
  locale: string;
}

export interface LocaleRouting {
  /** Every other locale's URL for this one, for `hreflang`. */
  alternatePathnames: (
    pathname: string,
  ) => { locale: string; pathname: string }[];
  alternatesFor: (internalPathname: string) => LocaleAlternate[];
  canonicalPathname: (pathname: string, locale: string) => string;
  canonicalUrlFor: (
    internalPathname: string,
    locale: string,
  ) => LocalePublicUrl;
  readonly defaultLocale: string;
  deLocalizePathname: (pathname: string, context?: LocaleHostContext) => string;
  deLocalizeUrl: (url: URL, context?: LocaleHostContext) => URL;
  domainForHost: (
    host: null | string | undefined,
  ) => ResolvedLocaleDomain | undefined;
  domainForLocale: (locale: string) => ResolvedLocaleDomain | undefined;
  readonly domains: readonly ResolvedLocaleDomain[];
  extractLocaleFromPath: (
    pathname: string,
    context?: LocaleHostContext,
  ) => string | undefined;
  isSupportedLocale: (value: null | string | undefined) => value is string;
  readonly localePrefix: LocalePrefixMode;
  readonly locales: readonly string[];
  localizePathname: (
    pathname: string,
    locale: string,
    context?: LocaleHostContext,
  ) => string;
  localizeUrl: (url: URL, locale: string, context?: LocaleHostContext) => URL;
  publicUrlFor: (
    internalPathname: string,
    locale: string,
    context?: LocaleHostContext,
  ) => LocalePublicUrl;
  redirectPathnameFor: (
    pathname: string,
    context?: LocaleHostContext,
  ) => string | undefined;
  redirectUrlFor: (url: URL, context?: LocaleHostContext) => undefined | URL;
  resolveLocale: (pathname: string, sources?: LocaleSources) => string;
  resolvePublicPathname: (
    pathname: string,
    sources?: LocaleSources,
  ) => ResolvedPublicPathname;
  readonly routePaths: RoutePathTranslator;
  /** `true` for `/api`, `/api/x`, `/admin`, `/admin/x`; `false` for `/discover`. */
  shouldIgnoreLocalePath: (pathname: string) => boolean;
}

interface HostScope {
  defaultLocale: string;
  domain?: ResolvedLocaleDomain;
  locales: readonly string[];
}

/** `/admin/` -> `/admin`, `admin` -> `/admin`. */
const RELATIVE_BASE = "https://vitnode.invalid";

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
 * string out, which is what lets the app, the server middleware and the tests
 * all reason about the same URLs.
 */
export const createLocaleRouting = ({
  defaultLocale,
  domains: domainConfigs,
  ignoredPaths = DEFAULT_IGNORED_LOCALE_PATHS,
  locales,
  localePrefix = "as-needed",
  routePaths: routePathConfig,
}: LocaleRoutingConfig): LocaleRouting => {
  const supported = new Set(locales);
  const ignored = ignoredPaths.map(normalizeIgnoredPath);

  const isSupportedLocale = (
    value: null | string | undefined,
  ): value is string => typeof value === "string" && supported.has(value);

  const shouldIgnoreLocalePath = (pathname: string): boolean =>
    ignored.some(path => pathname === path || pathname.startsWith(`${path}/`));

  const domains = resolveLocaleDomains({
    domains: domainConfigs,
    localePrefix,
    locales,
  });
  const routePaths = compileRoutePaths({
    isIgnoredPath: shouldIgnoreLocalePath,
    localePrefix,
    locales,
    routePaths: routePathConfig,
  });

  const domainForHost = (
    host: null | string | undefined,
  ): ResolvedLocaleDomain | undefined => {
    const normalized = normalizeHost(host);
    if (!normalized) return undefined;

    return domains.find(domain => domain.host === normalized);
  };

  const domainForLocale = (locale: string) =>
    domains.find(domain => domain.locales.includes(locale));

  const unassignedScope: HostScope =
    localePrefix === "never"
      ? { defaultLocale, locales: [defaultLocale] }
      : { defaultLocale, locales };

  const scopeOfDomain = (domain: ResolvedLocaleDomain): HostScope => ({
    defaultLocale: domain.defaultLocale,
    domain,
    locales: domain.locales,
  });

  const scopeFor = (host: null | string | undefined): HostScope => {
    const domain = domainForHost(host);

    return domain ? scopeOfDomain(domain) : unassignedScope;
  };

  /**
   * The prefix this configuration writes for `locale` - `""` when it writes
   * none. Unsupported input gets `""` rather than an invented prefix, so a
   * stale locale in a cookie degrades to the unprefixed URL instead of a 404.
   */
  const prefixFor = (locale: string, scope: HostScope): string => {
    if (localePrefix === "never" || !scope.locales.includes(locale)) return "";
    if (localePrefix === "always") return `/${locale}`;

    return locale === scope.defaultLocale ? "" : `/${locale}`;
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

  const resolveUnroutedLocale = (
    scope: HostScope,
    sources: LocaleSources,
  ): { locale: string; source: ResolvedLocaleSource } => {
    const { acceptLanguage, cookieLocale } = sources;

    if (isSupportedLocale(cookieLocale)) {
      return { locale: cookieLocale, source: "cookie" };
    }

    const negotiated = negotiateLocale(acceptLanguage, [...locales]);
    if (negotiated) return { locale: negotiated, source: "accept-language" };

    return {
      locale: scope.defaultLocale,
      source: scope.domain ? "domain" : "default",
    };
  };

  const resolvePublicPathname = (
    pathname: string,
    sources: LocaleSources = {},
  ): ResolvedPublicPathname => {
    const scope = scopeFor(sources.host);

    if (shouldIgnoreLocalePath(pathname)) {
      return {
        internalPathname: pathname,
        ...resolveUnroutedLocale(scope, sources),
      };
    }

    const { locale: prefixed, rest } = splitLocalePrefix(pathname);

    if (prefixed && shouldIgnoreLocalePath(rest)) {
      return {
        internalPathname: rest,
        ...resolveUnroutedLocale(scope, sources),
      };
    }

    // A public URL says which language it is in, and nothing else gets a vote.
    // A cookie or an `Accept-Language` that could override it would mean one URL
    // serving two languages: ambiguous to a crawler, unshareable between people
    // with different browsers, and a cache key that no CDN can compute.
    const locale = prefixed ?? scope.defaultLocale;
    const source: ResolvedLocaleSource = prefixed
      ? "prefix"
      : scope.domain
        ? "domain"
        : "default";

    return {
      internalPathname: routePaths.toInternal(
        prefixed ? rest : pathname,
        locale,
      ),
      locale,
      source,
    };
  };

  const deLocalizePathname = (
    pathname: string,
    context: LocaleHostContext = {},
  ): string => resolvePublicPathname(pathname, context).internalPathname;

  const extractLocaleFromPath = (
    pathname: string,
    context: LocaleHostContext = {},
  ): string | undefined => {
    if (shouldIgnoreLocalePath(pathname)) return undefined;

    const { locale } = splitLocalePrefix(pathname);

    // A prefix this configuration would not have written is not a locale: under
    // `"as-needed"`, `/en/discover` is a URL to be redirected, not the English
    // page. Treating it as one would leave two indexable URLs for one page.
    return locale && prefixFor(locale, scopeFor(context.host))
      ? locale
      : undefined;
  };

  const publicPathnameIn = (
    internalPathname: string,
    locale: string,
    scope: HostScope,
  ): string => {
    const translated = routePaths.toPublic(internalPathname, locale);
    const prefix = prefixFor(locale, scope);
    if (!prefix) return translated;

    return translated === "/" ? prefix : `${prefix}${translated}`;
  };

  const publicUrlFor = (
    internalPathname: string,
    locale: string,
    context: LocaleHostContext = {},
  ): LocalePublicUrl => {
    if (shouldIgnoreLocalePath(internalPathname)) {
      return { pathname: internalPathname };
    }

    const current = scopeFor(context.host);
    if (current.locales.includes(locale) || !isSupportedLocale(locale)) {
      return { pathname: publicPathnameIn(internalPathname, locale, current) };
    }

    const target = domainForLocale(locale);
    if (!target) {
      return {
        pathname: publicPathnameIn(internalPathname, locale, unassignedScope),
      };
    }

    return {
      origin: target.origin,
      pathname: publicPathnameIn(
        internalPathname,
        locale,
        scopeOfDomain(target),
      ),
    };
  };

  const canonicalUrlFor = (
    internalPathname: string,
    locale: string,
  ): LocalePublicUrl => {
    const target = domainForLocale(locale);
    if (!target || shouldIgnoreLocalePath(internalPathname)) {
      return publicUrlFor(internalPathname, locale);
    }

    return {
      origin: target.origin,
      pathname: publicPathnameIn(
        internalPathname,
        locale,
        scopeOfDomain(target),
      ),
    };
  };

  const toInternalInput = (pathname: string): string => {
    const { locale, rest } = splitLocalePrefix(pathname);

    return locale ? routePaths.toInternal(rest, locale) : pathname;
  };

  const localizePathname = (
    pathname: string,
    locale: string,
    context: LocaleHostContext = {},
  ): string => {
    const internal = toInternalInput(pathname);
    if (shouldIgnoreLocalePath(internal)) return internal;

    return publicPathnameIn(internal, locale, scopeFor(context.host));
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

  const withPublicUrl = (url: URL, target: LocalePublicUrl): URL => {
    if (!target.origin || target.origin === url.origin) {
      return withPathname(url, target.pathname);
    }

    const next = new URL(target.origin);
    next.pathname = target.pathname;
    next.search = url.search;
    next.hash = url.hash;

    return next;
  };

  const redirectUrlFor = (
    url: URL,
    context: LocaleHostContext = {},
  ): undefined | URL => {
    const { pathname } = url;

    // Already where it belongs: an ignored path carries no prefix by
    // definition, so there is nothing to canonicalise.
    if (shouldIgnoreLocalePath(pathname)) return undefined;

    const { locale: prefixed, rest } = splitLocalePrefix(pathname);

    // `/pl/admin` -> `/admin`. Ignored paths have no localized twin, and
    // serving one would split every admin URL in two.
    if (prefixed && shouldIgnoreLocalePath(rest)) {
      return withPathname(url, rest);
    }

    const { internalPathname, locale } = resolvePublicPathname(
      pathname,
      context,
    );
    const target = publicUrlFor(internalPathname, locale, context);

    if (!target.origin && target.pathname === pathname) return undefined;

    return withPublicUrl(url, target);
  };

  const redirectPathnameFor = (
    pathname: string,
    context: LocaleHostContext = {},
  ): string | undefined => {
    const target = redirectUrlFor(new URL(pathname, RELATIVE_BASE), context);
    if (target?.origin !== RELATIVE_BASE) return undefined;

    return target.pathname;
  };

  const resolveLocale = (
    pathname: string,
    sources: LocaleSources = {},
  ): string => resolvePublicPathname(pathname, sources).locale;

  const alternatesFor = (internalPathname: string): LocaleAlternate[] =>
    locales.map(locale => ({
      locale,
      ...canonicalUrlFor(internalPathname, locale),
    }));

  return {
    alternatePathnames: pathname => {
      const base = toInternalInput(pathname);

      return locales.map(locale => ({
        locale,
        pathname: publicPathnameIn(base, locale, unassignedScope),
      }));
    },
    alternatesFor,
    canonicalPathname: (pathname, locale) =>
      canonicalUrlFor(toInternalInput(pathname), locale).pathname,
    canonicalUrlFor,
    defaultLocale,
    deLocalizePathname,
    deLocalizeUrl: (url, context) =>
      withPathname(url, deLocalizePathname(url.pathname, context)),
    domainForHost,
    domainForLocale,
    domains,
    extractLocaleFromPath,
    isSupportedLocale,
    locales,
    localePrefix,
    localizePathname,
    localizeUrl: (url, locale, context = {}) => {
      const internal = toInternalInput(url.pathname);

      return withPublicUrl(url, publicUrlFor(internal, locale, context));
    },
    publicUrlFor,
    redirectPathnameFor,
    redirectUrlFor,
    resolveLocale,
    resolvePublicPathname,
    routePaths,
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
    "defaultLocale" | "domains" | "localePrefix" | "locales" | "routePaths"
  > & { locales: LocaleConfig[] },
  options: { ignoredPaths?: readonly string[] } = {},
): LocaleRouting =>
  createLocaleRouting({
    defaultLocale: i18n.defaultLocale,
    domains: i18n.domains,
    ignoredPaths: options.ignoredPaths,
    locales: i18n.locales
      .filter(locale => locale.enabled !== false)
      .map(locale => locale.code),
    localePrefix: i18n.localePrefix,
    routePaths: i18n.routePaths,
  });
