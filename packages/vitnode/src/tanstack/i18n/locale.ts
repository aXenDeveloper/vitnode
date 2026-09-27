import type { AnyRouter, LocationRewrite } from "@tanstack/react-router";

import { useRouterState } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

import { readLocaleCookie } from "@/lib/i18n/locale-cookie";

import { browserHostOf, requestHostOf } from "./host";
import { getIntlRuntime } from "./runtime";

const RELATIVE_BASE = "https://vitnode.invalid";

export type LocaleHostReader = () => string | undefined;

export interface LocaleHostOptions {
  readHost?: LocaleHostReader;
}

const readCookieLocale = createIsomorphicFn()
  .server(() => {
    try {
      return readLocaleCookie(getRequestHeader("cookie"));
    } catch {
      // `getRequestHeader` throws outside a request scope, which is where a
      // prerender pass and a test both build links from. No request means no
      // stored preference, which is exactly what the default locale is for.
      return undefined;
    }
  })
  // The locale cookie is deliberately not `HttpOnly`, so this read works: the
  // switcher writes it in the browser and the server reads the same one back.
  // `globalThis.document?.` rather than `document.`, because this branch is
  // bundled into the server too - only the client build ever drops one.
  .client(() => readLocaleCookie(globalThis.document?.cookie));

export const readRequestHost: LocaleHostReader = createIsomorphicFn()
  .server(() => {
    try {
      return requestHostOf(getRequest());
    } catch {
      return undefined;
    }
  })
  .client(() => browserHostOf(globalThis.location));

export const resolveLocale = <TLocale extends string = string>(
  publicPathname: string,
  { readHost = readRequestHost }: LocaleHostOptions = {},
): TLocale => {
  const { localeRouting } = getIntlRuntime();

  return localeRouting.resolveLocale(publicPathname, {
    // A getter, so a public path - which is most of what an app serves - never
    // reads a cookie at all.
    get cookieLocale() {
      return readCookieLocale();
    },
    host: readHost(),
  }) as TLocale;
};

export const publicPathnameOf = ({
  publicHref,
}: {
  publicHref: string;
}): string => new URL(publicHref, RELATIVE_BASE).pathname;

export const localizeHref = (
  href: string,
  locale: string,
  { readHost = readRequestHost }: LocaleHostOptions = {},
): string => {
  const { localeRouting } = getIntlRuntime();
  const url = localeRouting.localizeUrl(new URL(href, RELATIVE_BASE), locale, {
    host: readHost(),
  });

  return url.origin === RELATIVE_BASE
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href;
};

/**
 * The router's half of locale routing: one route tree, two public URL shapes.
 *
 *     browser  /pl/discover  --input-->  /discover      route tree
 *     <Link to="/discover">  --output->  /pl/discover   rendered href
 *
 * `input` is why no route file ever mentions a locale. It is also why an unknown
 * first segment still 404s: only a prefix the app actually writes gets stripped,
 * so `/xx/discover` reaches the route tree intact and matches nothing.
 *
 * `output` reads the locale from the router's own current location rather than
 * from `window` or a module variable. That is the same value on the server (a
 * memory history seeded with the request) as in the browser (the address bar),
 * which is what keeps the `href` React renders during SSR identical to the one
 * it renders after hydration.
 */
export const createLocaleRewrite = (
  getRouter: () => AnyRouter | undefined,
  { readHost = readRequestHost }: LocaleHostOptions = {},
): LocationRewrite => ({
  input: ({ url }) =>
    getIntlRuntime().localeRouting.deLocalizeUrl(url, { host: readHost() }),
  output: ({ url }) => {
    const location = getRouter()?.latestLocation;
    // Before the router has parsed a location there is nothing to read a locale
    // from - and no link has been built yet either.
    if (!location) return url;

    return getIntlRuntime().localeRouting.localizeUrl(
      url,
      resolveLocale(publicPathnameOf(location), { readHost }),
      { host: readHost() },
    );
  },
});

/**
 * The language the page is currently in, as reactive state.
 *
 * Subscribed to the router's location rather than read off `window`, so a
 * language switch re-renders everything downstream of it - the provider, the
 * message query, `<html lang>` - with no reload and no second source of truth.
 */
export const useLocale = <TLocale extends string = string>(): TLocale =>
  // `useRouterState` describes its result through its own generic, which cannot
  // be proven equal to a caller-supplied `TLocale`. The selector above is the
  // one that produces the value, so the assertion re-states what it already
  // guarantees rather than widening anything.
  useRouterState({
    select: state => resolveLocale<TLocale>(publicPathnameOf(state.location)),
  }) as TLocale;
