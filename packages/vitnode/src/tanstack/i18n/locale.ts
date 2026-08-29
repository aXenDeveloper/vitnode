import type { AnyRouter, LocationRewrite } from "@tanstack/react-router";

import { useRouterState } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { readLocaleCookie } from "@/lib/i18n/locale-cookie";

import { getIntlRuntime } from "./runtime";

/**
 * A base for parsing a router href that carries no origin. Never requested, and
 * never rendered - only `pathname`, `search` and `hash` are ever read back off
 * it.
 */
const RELATIVE_BASE = "https://vitnode.invalid";

/**
 * The remembered language, wherever this happens to be running.
 *
 * Only routes outside the localized URL space ever ask - `/admin`, and anything
 * else in `DEFAULT_IGNORED_LOCALE_PATHS`. A public URL says which language it is
 * in, and this must never get a vote there.
 *
 * `createIsomorphicFn` is what keeps that one question from becoming two
 * functions that drift, and it is the one Start primitive this package is
 * allowed to declare. In the browser bundle the host's Vite build compiles it,
 * so the `.server()` branch - and the `@tanstack/react-start/server` import
 * above with it - is dropped. On the server the package is un-compiled, and the
 * stub falls back to the `.server()` branch, which is the right answer there.
 * That asymmetry is the whole reason `.server()` is written first: the fallback
 * keeps the server implementation it was given and ignores a `.client()` chained
 * after it.
 */
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

/**
 * The language a URL is served in - the one authoritative answer.
 *
 * Everything that needs a locale comes through here: the router rewrite that
 * writes prefixes into links, `<html lang>`, the message query, the switcher.
 * There is deliberately no second source to disagree with it.
 *
 * `publicPathname` is the URL in the address bar, *before* the router rewrote
 * the prefix away. Handing it the internal path would resolve every request to
 * the default locale.
 *
 * The cookie is the only source handed to the shared helper, and that is the
 * whole contract for a route with no locale in its URL: **cookie, then the
 * default.** The helper can also negotiate an `Accept-Language` header and
 * deliberately is not asked to - the browser cannot read request headers, so a
 * server that answered `pl` from one would hydrate to `en` on the client: a
 * flash of the wrong language and a React hydration mismatch on every first
 * visit. First-visit negotiation is a product decision that needs its own
 * hydration-safe design, not a source quietly added here.
 *
 * The type parameter is how an app keeps its own `"en" | "pl"` union: the answer
 * is either a code that app was configured with or its default, never anything
 * from the URL, so narrowing it is safe by construction.
 */
export const resolveLocale = <TLocale extends string = string>(
  publicPathname: string,
): TLocale => {
  const { localeRouting } = getIntlRuntime();

  return localeRouting.resolveLocale(publicPathname, {
    // A getter, so a public path - which is most of what an app serves - never
    // reads a cookie at all.
    get cookieLocale() {
      return readCookieLocale();
    },
  }) as TLocale;
};

/**
 * The path shown in the address bar, from a location the router parsed.
 *
 * Takes the one field it reads rather than a `ParsedLocation`, so it is equally
 * callable with `router.latestLocation`, with router state, and with a
 * `beforeLoad`'s `location` - three types that differ only in their search
 * schema.
 */
export const publicPathnameOf = ({
  publicHref,
}: {
  publicHref: string;
}): string => new URL(publicHref, RELATIVE_BASE).pathname;

/**
 * An internal href, written in the public shape for one language.
 *
 *     /blog/post-30  + pl -> /pl/blog/post-30
 *     /blog/post-30  + en -> /blog/post-30
 *     /admin/users   + pl -> /admin/users     (an ignored path takes no prefix)
 *
 * For links the router will never build. Anything it *does* build gets its
 * prefix from `rewrite.output` instead, and applying both would produce
 * `/pl/pl/...` - so this is only for a boundary where the destination belongs to
 * another application and the router is deliberately not involved.
 *
 * `localizeUrl` is the same rule the rewrite uses and is idempotent, so an href
 * that already carries a prefix keeps exactly one. The query string and hash are
 * preserved.
 */
export const localizeHref = (href: string, locale: string): string => {
  const { localeRouting } = getIntlRuntime();
  const url = localeRouting.localizeUrl(new URL(href, RELATIVE_BASE), locale);

  return `${url.pathname}${url.search}${url.hash}`;
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
): LocationRewrite => ({
  input: ({ url }) => getIntlRuntime().localeRouting.deLocalizeUrl(url),
  output: ({ url }) => {
    const location = getRouter()?.latestLocation;
    // Before the router has parsed a location there is nothing to read a locale
    // from - and no link has been built yet either.
    if (!location) return url;

    return getIntlRuntime().localeRouting.localizeUrl(
      url,
      resolveLocale(publicPathnameOf(location)),
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
