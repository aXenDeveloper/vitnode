import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import type { Locale } from "./shared";

import {
  defaultLocale,
  extractLocaleFromPath,
  isValidLocale,
  LOCALE_COOKIE,
  shouldIgnorePath,
  stripLocaleSegment,
} from "./shared";

/**
 * The locale for the current request or document.
 *
 * Both branches follow the same rule so server and client always agree - a
 * disagreement here surfaces as a hydration mismatch:
 *
 * - ignored paths (`/admin`, `/api`) carry no prefix, so the cookie decides
 * - every other path is described entirely by its URL
 *
 * `createIsomorphicFn` is compiled away per environment, which is what keeps
 * the server-only `getRequest` import out of the browser bundle.
 */
export const getCurrentLocale = createIsomorphicFn()
  .server((): Locale => {
    const url = new URL(getRequest().url);

    if (shouldIgnorePath(url.pathname)) {
      return readCookieLocale(getRequest().headers.get("cookie"));
    }

    return extractLocaleFromPath(url.pathname) ?? defaultLocale;
  })
  .client((): Locale => {
    const { pathname } = window.location;

    if (shouldIgnorePath(pathname)) {
      return readCookieLocale(document.cookie);
    }

    return extractLocaleFromPath(pathname) ?? defaultLocale;
  });

/** Reads `LOCALE_COOKIE` out of a `Cookie` header or `document.cookie`. */
export const readCookieLocale = (header: null | string): Locale => {
  const value = header
    ?.split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);

  return isValidLocale(value) ? value : defaultLocale;
};

/**
 * Turns a public URL into the one the router matches against: `/pl/about`
 * becomes `/about`, so the route tree never carries a locale segment.
 */
export const deLocalizeUrl = (url: URL): URL => {
  if (shouldIgnorePath(url.pathname)) return url;

  const locale = extractLocaleFromPath(url.pathname);

  if (!locale) return url;

  const next = new URL(url);
  next.pathname = stripLocaleSegment(url.pathname, locale);

  return next;
};

/**
 * The inverse: turns a router URL into the public one, so `<Link to="/about">`
 * renders `/pl/about` while the visitor is reading Polish.
 *
 * The router derives every href it commits to history through this, so it has
 * to stay an exact inverse of `deLocalizeUrl` or navigation will bounce.
 */
export const localizeUrl = (url: URL): URL => {
  if (shouldIgnorePath(url.pathname)) return url;

  const locale = getCurrentLocale();

  if (locale === defaultLocale) return url;

  const next = new URL(url);
  next.pathname = `/${locale}${url.pathname === "/" ? "" : url.pathname}`;

  return next;
};

/** The public path a given locale would serve `pathname` at. */
export const localizedPath = (pathname: string, locale: Locale): string => {
  if (shouldIgnorePath(pathname)) return pathname;

  const base = deLocalizeUrl(new URL(pathname, "http://localhost")).pathname;

  if (locale === defaultLocale) return base;

  return `/${locale}${base === "/" ? "" : base}`;
};
