import type { AnyRouter } from '@tanstack/react-router'

import { localeRouting } from '#/lib/i18n/shared'

/**
 * Asking the route tree, in a test, whether it declares a URL.
 *
 * Test-only, and deliberately not shipped: no application code asks this
 * question any more. The router *is* the application, so a `<Link to="/discover">`
 * simply navigates and a path nothing declares reaches the not-found boundary -
 * there is no branch anywhere that consults a route table before deciding how to
 * move.
 *
 * What is still worth asserting is the other direction: that a destination
 * something *else* names - a header nav record, an AdminCP sidebar entry, a
 * settings menu key, a `?returnTo=` a guard will redirect to - is a URL this
 * tree actually declares. Those records are written by hand and by plugins, and
 * nothing but a test connects them to the route files. A crumb pointing at
 * `/admin/core/user` renders perfectly and 404s on click.
 *
 * There is no list of paths here and there must not be one. The route tree is
 * the answer; this only phrases the question.
 */

/**
 * A base for parsing an href that carries no origin. Never requested, and never
 * rendered - only `pathname` is ever read back off it.
 */
const RELATIVE_BASE = 'https://vitnode.invalid'

/** The API mount is not a page. */
const isApiRouteId = (routeId: string): boolean =>
  routeId === '/api' || routeId.startsWith('/api/')

/** A trailing slash is not a different page. `/` stays `/`. */
const trimTrailingSlash = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/')
    ? pathname.replace(/\/+$/, '')
    : pathname

/**
 * Whether this app's route tree declares a page at `href`.
 *
 * Four things have to happen before the answer is trusted:
 *
 * 1. **Strip the query and hash.** `matchRoutes` takes a *pathname*;
 *    `/discover?a=1` matches nothing.
 * 2. **De-localize.** The route tree has no locale in it, so `/pl/discover`
 *    matches nothing until the prefix comes off - the app's own rule, from
 *    `localeRouting`, rather than a prefix check written here.
 * 3. **Reject an href that carries its own origin.** `new URL(href, base)`
 *    resolves an absolute URL against *itself* and only `.pathname` is read
 *    back, so `https://status.example.com` would arrive as `/`, match the front
 *    page and be reported as a route this app declares. A plugin's `admin.nav`
 *    entry may legitimately point at a docs site or a status page, which is why
 *    this is a real case rather than a hypothetical one.
 * 4. **Insist the deepest match consumed the whole path.** See below.
 *
 * ## Why "something matched" is not enough
 *
 * `matchRoutes` matches a *branch*, not a leaf: given a path it cannot fully
 * resolve, it answers with the deepest ancestor that does match and leaves the
 * rest unconsumed. So `/login/reset-password` comes back as a match on `/login`
 * and `/discover/anything` as a match on `/discover` - and under a
 * "matched.length > 0" rule both would look declared, which would make this
 * helper answer `true` for every URL under any route in the tree and assert
 * nothing at all.
 *
 * Comparing the deepest match's own `pathname` to the requested one is the whole
 * fix, and it is the router's own answer rather than a second opinion: a real
 * match consumed the path (`/login/sso/google` matches at `/login/sso/google`),
 * a partial one did not. A path nothing matched resolves to the root alone, at
 * `/`, and fails the same test.
 */
export const resolvesToRoute = (router: AnyRouter, href: string): boolean => {
  const url = localeRouting.deLocalizeUrl(new URL(href, RELATIVE_BASE))

  if (url.origin !== RELATIVE_BASE) return false

  const { pathname } = url

  const matches = router.matchRoutes(pathname, undefined) as {
    pathname: string
    routeId: string
  }[]
  const deepest = matches.at(-1)

  if (!deepest || deepest.routeId === '__root__') return false
  if (matches.some((match) => isApiRouteId(match.routeId))) return false

  return trimTrailingSlash(deepest.pathname) === trimTrailingSlash(pathname)
}
