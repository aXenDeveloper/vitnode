import { createMiddleware } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";

import type { Locale } from "./shared";

import {
  defaultLocale,
  isValidLocale,
  LOCALE_COOKIE,
  shouldIgnorePath,
  stripLocaleSegment,
} from "./shared";

/** A year, in seconds. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface LocaleResolution {
  /** Where to send the visitor instead of rendering, if anywhere. */
  redirect?: string;
  /** The locale the URL states outright, which the cookie should catch up to. */
  setCookie?: Locale;
}

/**
 * Decides what a request's URL means for the locale, before React renders.
 *
 * This has to run at the request layer rather than in a route: a route can
 * throw `notFound()`, but by the time it runs the response has already started
 * streaming, so it can no longer answer with a redirect.
 *
 * In order:
 *
 * 1. ignored paths are left alone - they are never prefixed
 * 2. `/en/*` is not canonical, since the default locale has no prefix
 * 3. a prefix in front of an ignored path is dropped (`/pl/admin` -> `/admin`)
 * 4. otherwise the URL names a locale, so the cookie is brought in line
 */
const serializeLocaleCookie = (locale: Locale): string =>
  `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;

export const handleLocaleMiddleware = (request: Request): LocaleResolution => {
  const { pathname, search } = new URL(request.url);

  if (shouldIgnorePath(pathname)) return {};

  const segment = pathname.split("/")[1];

  if (segment === defaultLocale) {
    return {
      redirect: stripLocaleSegment(pathname, defaultLocale) + search,
      setCookie: defaultLocale,
    };
  }

  // An unprefixed public path is the default locale stated outright, so the
  // cookie follows it too - otherwise switching back to English would leave
  // `/admin` reading a stale locale.
  if (!isValidLocale(segment)) return { setCookie: defaultLocale };

  const stripped = stripLocaleSegment(pathname, segment);

  if (shouldIgnorePath(stripped)) {
    return { redirect: stripped + search, setCookie: segment };
  }

  return { setCookie: segment };
};

/**
 * Applies `handleLocaleMiddleware` to every incoming request.
 *
 * Registered through `createStart` so it runs ahead of the router, which is the
 * only place a redirect is still possible.
 */
export const localeRequestMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, request }) => {
  const { redirect, setCookie: locale } = handleLocaleMiddleware(request);

  // A redirect is returned as its own Response, which never passes through the
  // response context `setCookie` writes to - so it carries the header itself.
  if (redirect !== undefined) {
    const headers = new Headers({ location: redirect });

    if (locale) headers.append("set-cookie", serializeLocaleCookie(locale));

    return new Response(null, { headers, status: 301 });
  }

  if (locale) {
    setCookie(LOCALE_COOKIE, locale, {
      httpOnly: false,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }

  return await next();
});
