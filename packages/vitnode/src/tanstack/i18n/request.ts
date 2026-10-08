import "@tanstack/react-start/server-only";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { serializeLocaleCookie } from "@/lib/i18n/locale-cookie";
import { urlLocaleToRemember } from "@/lib/i18n/remembered-locale";

import { requestHostOf } from "./host";

export interface LocaleRequestPlan {
  /** A finished response to send instead of rendering. */
  redirect?: Response;
  /** A `Set-Cookie` value to append to whatever the app renders. */
  setCookie?: string;
}

const API_PATH = "/api";

const isApiPath = (pathname: string): boolean =>
  pathname === API_PATH || pathname.startsWith(`${API_PATH}/`);

/**
 * Everything about a request's locale that has to be decided before rendering.
 *
 * Three jobs, in order:
 *
 * 1. **Remembering an explicit choice.** Arriving at `/pl/...` *is* a statement
 *    about language, so it updates the cookie that `/admin` reads. Arriving at
 *    an unprefixed URL is not: `/discover` is English because English is the
 *    default, not because the visitor chose it, and overwriting a stored `pl`
 *    with `en` on every such visit would quietly undo the switcher.
 *
 * 2. **Canonicalisation.** `/en` and `/en/discover` are the default locale
 *    written out longhand; the URLs an app serves are `/` and `/discover`.
 *    Two URLs for one page splits its ranking, its cache entries and its share
 *    links, so the long form redirects permanently to the short one - query
 *    string and hash intact.
 *
 * 3. **Stripping ignored paths.** `/pl/admin` is a locale prefix in front of a
 *    route that never carries one, so it redirects to `/admin`.
 *
 * The order of the first two matters, and getting it wrong is invisible.
 * `/pl/admin` is both an explicit choice *and* a redirect, and the redirect is
 * the end of the request - so the cookie has to be attached to it. Deciding the
 * redirect first and the cookie afterwards means the browser follows `/admin`
 * carrying nothing, `/admin` finds no stored preference, and the language the
 * visitor just asked for by URL is gone before the page they asked for renders.
 *
 * `/api/*` gets none of it - see {@link isApiPath} and `shouldIgnoreLocalePath`.
 *
 * 308 rather than 301: both are permanent and both are treated the same by
 * search engines, but 308 is the one that forbids a client from replaying the
 * request as a `GET`. Nothing under a locale prefix is a form post today; if one
 * ever is, this stays correct instead of silently dropping its body.
 *
 * `localeRouting` is handed in rather than read from the registered runtime,
 * because this runs in the host's global request middleware - which Start
 * executes before route matching and therefore before anything else in this
 * namespace has necessarily been reached. An explicit argument makes that
 * ordering a fact of the call rather than a hope about module evaluation.
 */
export const handleLocaleRequest = (
  request: Request,
  localeRouting: LocaleRouting,
): LocaleRequestPlan => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (localeRouting.shouldIgnoreLocalePath(pathname)) return {};

  const host = requestHostOf(request);

  // Read before anything redirects. `extractLocaleFromPath` answers only for a
  // prefix this app actually writes, so `/en/admin` - the default locale spelled
  // out - is a URL to canonicalise rather than a choice to record.
  const rememberedLocale = urlLocaleToRemember({
    cookieHeader: request.headers.get("cookie"),
    host,
    localeRouting,
    pathname,
  });
  // Only when it would actually change something. A `Set-Cookie` on every
  // request to a prefixed URL makes each of them individually cacheable and
  // achieves nothing else.
  const setCookie = rememberedLocale
    ? serializeLocaleCookie(rememberedLocale, {
        secure: url.protocol === "https:",
      })
    : undefined;

  const redirectTo = localeRouting.redirectUrlFor(url, { host });
  if (redirectTo === undefined) return setCookie ? { setCookie } : {};

  const location = locationHeaderFor(redirectTo, url, localeRouting);
  if (location === undefined) return setCookie ? { setCookie } : {};

  const headers = new Headers({ location: location.value });

  // The API is the one destination that learns nothing from the prefix it was
  // given: `/pl/api/foo` is a mistake to correct, not a language to remember.
  if (setCookie && !location.crossOrigin && !isApiPath(redirectTo.pathname)) {
    headers.append("set-cookie", setCookie);
  }

  // Built by hand rather than with `Response.redirect`, whose headers are
  // immutable - the cookie above could never be attached to one.
  return { redirect: new Response(null, { headers, status: 308 }) };
};

const locationHeaderFor = (
  target: URL,
  requested: URL,
  localeRouting: LocaleRouting,
): undefined | { crossOrigin: boolean; value: string } => {
  // Leading slashes collapsed to exactly one. A `Location` of `//example.com` is
  // not a path at all - it is a *protocol-relative URL*, and the browser reads
  // everything after the two slashes as a host. Canonicalising `/en//evil.com`
  // strips the `/en` and leaves precisely that, so the site answered a request
  // for one of its own URLs with a 308 to somebody else's - a phishing link that
  // is genuinely hosted on this domain. A backslash is folded in too, because
  // browsers treat it as a separator here even though the URL parser does not.
  const pathname = target.pathname.replace(/^[/\\]+/, "/");
  const path = pathname + target.search + target.hash;

  if (target.origin === requested.origin) {
    return { crossOrigin: false, value: path };
  }

  if (!localeRouting.domains.some(domain => domain.origin === target.origin)) {
    return undefined;
  }

  return { crossOrigin: true, value: target.origin + path };
};
