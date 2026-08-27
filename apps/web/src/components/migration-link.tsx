import type { AnyRouter } from '@tanstack/react-router'

import { Link, useRouter } from '@tanstack/react-router'

import { localizeHref, useLocale } from '#/lib/i18n/client'
import { localeRouting } from '#/lib/i18n/shared'

/**
 * Linking to a VitNode page while half of VitNode still runs on Next.js.
 *
 * This app owns three routes today - `/`, `/discover` and the `/api/*` mount -
 * and search results point at all of the ones it does not: `/blog/post-30`,
 * `/files/...`, `/admin/...`, whatever a plugin indexed. Handing every
 * internal-looking path to `<Link>` routes those into *this* router, which has
 * nothing to match them with, so a perfectly good blog post becomes a TanStack
 * not-found page. During a strangler migration a full document load to the
 * running Next.js app is the correct answer, not a fallback.
 *
 * So: ask the router what it owns, and let it answer.
 *
 *     owned      -> <Link>, client-side navigation, locale prefix from the rewrite
 *     not owned  -> <a href>, document navigation, locale prefix applied here
 *
 * This is deliberately not a cross-framework navigation system, and there is no
 * hand-maintained table of migrated routes - the route tree *is* the table. When
 * `/blog` is migrated it appears in the generated tree, `isTanStackOwnedPath`
 * starts answering `true` for it, and nothing here changes.
 */

/**
 * The API mount is not a page.
 *
 * `/api/$` is a real route in the generated tree - it is how Hono is mounted -
 * so it matches, and without this a search result pointing into `/api` would be
 * handed to the router as a client-side navigation to a route that renders
 * nothing. Matched by route id rather than by a hardcoded pathname, so it stays
 * correct if the mount ever moves.
 */
const isApiRouteId = (routeId: string): boolean =>
  routeId === '/api' || routeId.startsWith('/api/')

/**
 * Whether this app's route tree can render `href` itself.
 *
 * Three things have to happen before the router is asked, and each one is a way
 * this returned the wrong answer while it was being written:
 *
 * 1. **Strip the query and hash.** `matchRoutes` takes a *pathname*;
 *    `/discover?a=1` matches nothing.
 * 2. **De-localize.** The route tree has no locale in it - that is the whole of
 *    Stage 3 - so `/pl/discover` matches nothing until the prefix comes off.
 * 3. **Reject the API mount.** See {@link isApiRouteId}.
 *
 * An unmatched path resolves to the root route alone, so "something below the
 * root matched" is the test. That also means a root-level catch-all route would
 * make every path look owned; there is none today, and
 * `migration-link.test.tsx` fails loudly if one appears.
 */
export const isTanStackOwnedPath = (
  router: AnyRouter,
  href: string,
): boolean => {
  // The same rule `rewrite.input` applies, from the same Stage 3 helper - the
  // rewrite is `deLocalizeUrl` and nothing else, so this is one rule, not a copy.
  const { pathname } = localeRouting.deLocalizeUrl(
    new URL(href, 'https://vitnode.invalid'),
  )

  const matched = router
    .matchRoutes(pathname, undefined)
    .map((match: { routeId: string }) => match.routeId)
    .filter((routeId: string) => routeId !== '__root__')

  return matched.length > 0 && !matched.some(isApiRouteId)
}

/**
 * A link to anywhere in VitNode, migrated or not.
 *
 * The locale is applied exactly once on each branch and never by hand:
 *
 * - **Owned.** `<Link to>` takes the *internal* path and the router's
 *   `rewrite.output` writes the prefix, so `/discover` renders as `/pl/discover`
 *   while reading Polish. Adding one here would double it.
 * - **Not owned.** The router never sees the URL, so the rewrite never runs on
 *   it - `localizeHref` applies the same Stage 3 rule instead. It is idempotent,
 *   so an already-prefixed href stays single-prefixed.
 *
 * Search parameters and hashes survive both branches untouched.
 */
export const MigrationLink = ({
  children,
  className,
  href,
}: {
  children: React.ReactNode
  className?: string
  href: string
}) => {
  const router = useRouter()
  const locale = useLocale()

  if (isTanStackOwnedPath(router, href)) {
    return (
      <Link className={className} to={href}>
        {children}
      </Link>
    )
  }

  return (
    <a className={className} href={localizeHref(href, locale)}>
      {children}
    </a>
  )
}
