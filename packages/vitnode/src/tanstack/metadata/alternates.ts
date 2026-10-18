import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { CONFIG } from "@/lib/config";

import { getIntlRuntime } from "../i18n/runtime";

export const X_DEFAULT_HREFLANG = "x-default";

/** A `<link>` a route's `head` emits. */
export interface RouteHeadLink {
  href: string;
  hrefLang?: string;
  rel: "alternate" | "canonical";
}

/** A page's internal (unprefixed) path per locale code, e.g. `{ en: "/blog/hello" }`. */
export type LocaleAlternates = Readonly<Record<string, string>>;

interface LocaleAlternateLinksBase {
  /** The locale being rendered; picks the canonical link. */
  locale: string;
  /** Defaults to the app's configured locale routing. */
  localeRouting?: LocaleRouting;
  /** Defaults to the configured web origin; a locale bound to its own domain uses that domain. */
  webOrigin?: string | URL;
}

/**
 * Either explicit per-locale paths (`alternates`), or one `internalPathname`
 * that exists in every locale (`locales`, defaulting to all configured ones).
 */
export type LocaleAlternateLinksOptions = LocaleAlternateLinksBase &
  (
    | { alternates: LocaleAlternates }
    | { internalPathname: string; locales?: readonly string[] }
  );

export const isInternalPathname = (value: unknown): value is string =>
  typeof value === "string" && /^\/(?![/\\])/.test(value);

const alternatesOf = (
  options: LocaleAlternateLinksOptions,
  localeRouting: LocaleRouting,
): [string, string][] => {
  const entries =
    "alternates" in options
      ? Object.entries(options.alternates)
      : (options.locales ?? localeRouting.locales).map(
          (locale): [string, string] => [locale, options.internalPathname],
        );

  return entries.filter(
    ([locale, pathname]) =>
      localeRouting.isSupportedLocale(locale) && isInternalPathname(pathname),
  );
};

const absoluteHref = (
  origin: () => string | URL,
  pathname: string,
): string | undefined => {
  try {
    const url = new URL(origin());
    url.pathname = pathname;
    url.search = "";
    url.hash = "";

    return url.href;
  } catch {
    return undefined;
  }
};

/**
 * The canonical link and `hreflang` alternates of a page that exists in several
 * locales, as absolute URLs with each locale's prefix or domain applied: a
 * `canonical` for `locale` (the default locale's URL when `locale` has none),
 * one `alternate` per locale, and `x-default` pointing at the default locale
 * when it is one of them.
 *
 * Unsupported locales and paths that are not internal (`/...`) are skipped;
 * returns `[]` when nothing is left. Universal.
 */
export const localeAlternateLinks = (
  options: LocaleAlternateLinksOptions,
): RouteHeadLink[] => {
  const localeRouting = options.localeRouting ?? getIntlRuntime().localeRouting;
  const webOrigin = () => options.webOrigin ?? CONFIG.web;

  const hrefs = new Map<string, string>();
  for (const [locale, internalPathname] of alternatesOf(
    options,
    localeRouting,
  )) {
    const target = localeRouting.canonicalUrlFor(internalPathname, locale);
    const { origin } = target;
    const href = absoluteHref(
      origin === undefined ? webOrigin : () => origin,
      target.pathname,
    );
    if (href !== undefined) hrefs.set(locale, href);
  }

  if (hrefs.size === 0) return [];

  const fallback = hrefs.get(localeRouting.defaultLocale);
  const canonical = hrefs.get(options.locale) ?? fallback;

  return [
    ...(canonical === undefined
      ? []
      : [{ href: canonical, rel: "canonical" as const }]),
    ...[...hrefs].map(([hrefLang, href]) => ({
      href,
      hrefLang,
      rel: "alternate" as const,
    })),
    ...(fallback === undefined
      ? []
      : [
          {
            href: fallback,
            hrefLang: X_DEFAULT_HREFLANG,
            rel: "alternate" as const,
          },
        ]),
  ];
};

export const declaredLocaleAlternates = (
  matches: readonly { links?: unknown }[],
): ReadonlyMap<string, string> | undefined => {
  for (let index = matches.length - 1; index >= 0; index--) {
    const { links } = matches[index];
    if (!Array.isArray(links)) continue;

    const alternates = new Map<string, string>();
    for (const link of links as unknown[]) {
      if (typeof link !== "object" || link === null) continue;

      const { href, hrefLang, rel } = link as Partial<RouteHeadLink>;
      if (
        rel === "alternate" &&
        typeof hrefLang === "string" &&
        hrefLang !== X_DEFAULT_HREFLANG &&
        typeof href === "string"
      ) {
        alternates.set(hrefLang, href);
      }
    }

    if (alternates.size > 0) return alternates;
  }

  return undefined;
};
