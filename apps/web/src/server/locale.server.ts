import '@tanstack/react-start/server-only'
import {
  LOCALE_COOKIE_NAME,
  readLocaleCookie,
  serializeLocaleCookie,
} from '@vitnode/core/lib/i18n/locale-cookie'

import { localeRouting } from '#/lib/i18n/shared'

/**
 * What the locale layer wants done to one request, before anything renders.
 *
 * Returned as data rather than performed, so the rule is testable without a
 * server: `handleLocaleRequest` is a pure function of the request, and the
 * middleware below is the three lines that carry out its answer.
 */
export interface LocaleRequestPlan {
  /** A finished response to send instead of rendering. */
  redirect?: Response
  /** A `Set-Cookie` value to append to whatever the app renders. */
  setCookie?: string
}

/**
 * Everything about a request's locale that has to be decided before rendering.
 *
 * Three jobs, in order:
 *
 * 1. **Canonicalisation.** `/en` and `/en/discover` are the default locale
 *    written out longhand; the URLs this app serves are `/` and `/discover`.
 *    Two URLs for one page splits its ranking, its cache entries and its share
 *    links, so the long form redirects permanently to the short one - query
 *    string and hash intact.
 *
 * 2. **Stripping ignored paths.** `/pl/admin` and `/pl/api/foo` are locale
 *    prefixes in front of routes that never carry one. They redirect to the
 *    unprefixed URL rather than being maintained as a second address for the
 *    AdminCP and the API.
 *
 * 3. **Remembering an explicit choice.** Arriving at `/pl/...` *is* a statement
 *    about language, so it updates the cookie that `/admin` reads. Arriving at
 *    an unprefixed URL is not: `/discover` is English because English is the
 *    default, not because the visitor chose it, and overwriting a stored `pl`
 *    with `en` on every such visit would quietly undo the switcher.
 *
 * `/api/*` is untouched by all three - see `shouldIgnoreLocalePath`. The Hono
 * application mounted there answers for itself.
 *
 * 308 rather than 301: both are permanent and both are treated the same by
 * search engines, but 308 is the one that forbids a client from replaying the
 * request as a `GET`. Nothing under a locale prefix is a form post today; if one
 * ever is, this stays correct instead of silently dropping its body.
 */
export const handleLocaleRequest = (request: Request): LocaleRequestPlan => {
  const url = new URL(request.url)
  const { pathname } = url

  if (localeRouting.shouldIgnoreLocalePath(pathname)) return {}

  const redirectTo = localeRouting.redirectPathnameFor(pathname)
  if (redirectTo !== undefined) {
    const target = new URL(url)
    target.pathname = redirectTo

    // Built by hand rather than with `Response.redirect`, whose headers are
    // immutable - the cookie below could never be attached to one.
    return {
      redirect: new Response(null, {
        headers: { location: target.pathname + target.search + target.hash },
        status: 308,
      }),
    }
  }

  const urlLocale = localeRouting.extractLocaleFromPath(pathname)
  if (!urlLocale) return {}

  // Only when it would actually change something. A `Set-Cookie` on every
  // request to a prefixed URL makes each of them individually cacheable and
  // nothing else.
  const cookieLocale = readLocaleCookie(
    request.headers.get('cookie'),
    LOCALE_COOKIE_NAME,
  )
  if (cookieLocale === urlLocale) return {}

  return {
    setCookie: serializeLocaleCookie(urlLocale, {
      secure: url.protocol === 'https:',
    }),
  }
}
