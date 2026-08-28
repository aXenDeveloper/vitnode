import type { AnyRouter } from '@tanstack/react-router'

import { Link, useRouter } from '@tanstack/react-router'

import { useLocale } from '#/lib/i18n/client'
import { localeRouting } from '#/lib/i18n/shared'
import { buildLegacyHref, legacyWebOrigin } from '#/lib/legacy-app'

/**
 * Linking to a VitNode page while half of VitNode still runs on Next.js.
 *
 * This app owns four routes today - `/`, `/discover`, the `/api/*` mount and the
 * `@vitnode/example` plugin's `/example` - and search results point at all of the
 * ones it does not: `/blog/post-30`,
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
 * `/blog` is migrated it appears in the route tree, `isTanStackOwnedPath` starts
 * answering `true` for it, and nothing here changes. Stage 5 is the proof: a
 * plugin declared `/example`, `lib/plugin-routes.ts` mounted it on the same tree,
 * and this file was not touched.
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

/** A trailing slash is not a different page. `/` stays `/`. */
const trimTrailingSlash = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/')
    ? pathname.replace(/\/+$/, '')
    : pathname

/**
 * Whether this app's route tree can render `href` itself.
 *
 * Four things have to happen before the answer is trusted, and each one is a way
 * this returned the wrong answer while it was being written:
 *
 * 1. **Strip the query and hash.** `matchRoutes` takes a *pathname*;
 *    `/discover?a=1` matches nothing.
 * 2. **De-localize.** The route tree has no locale in it - that is the whole of
 *    Stage 3 - so `/pl/discover` matches nothing until the prefix comes off.
 * 3. **Reject the API mount.** See {@link isApiRouteId}.
 * 4. **Insist the deepest match consumed the whole path.** See below.
 *
 * ## Why "something matched" is not enough
 *
 * `matchRoutes` matches a *branch*, not a leaf: given a path it cannot fully
 * resolve, it answers with the deepest ancestor that does match and leaves the
 * rest unconsumed. So `/login/reset-password` comes back as a match on `/login`,
 * and `/discover/anything` as a match on `/discover` - and under the old
 * "matched.length > 0" rule both looked owned. That is not a cosmetic
 * difference: `MigrationLink` would hand a page the Next.js app still serves to
 * this router as a client-side navigation, turning a working password reset into
 * a TanStack not-found.
 *
 * Comparing the deepest match's own `pathname` to the requested one is the whole
 * fix, and it is the router's own answer rather than a second opinion: a real
 * match consumed the path (`/login/sso/google` matches at `/login/sso/google`),
 * a partial one did not (`/login/reset-password` matches at `/login`). A path
 * nothing matched resolves to the root alone, at `/`, and fails the same test.
 *
 * `src/tests/plugin-routes.test.ts` pins every one of these cases.
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

  const matches = router.matchRoutes(pathname, undefined) as {
    pathname: string
    routeId: string
  }[]
  const deepest = matches.at(-1)

  if (!deepest || deepest.routeId === '__root__') return false
  if (matches.some((match) => isApiRouteId(match.routeId))) return false

  return trimTrailingSlash(deepest.pathname) === trimTrailingSlash(pathname)
}

/**
 * A link to anywhere in VitNode, migrated or not.
 *
 * The two branches differ in origin as well as in mechanism, which is the whole
 * point: a relative `/blog/post-1` from this app resolves against *this* app,
 * so it turned a client-side not-found into a full-document not-found rather
 * than reaching the application that owns the route.
 *
 * - **Owned.** `<Link to>` takes the *internal* path and stays relative. The
 *   router's `rewrite.output` writes the locale prefix, so `/discover` renders
 *   as `/pl/discover` while reading Polish. Neither an origin nor a prefix is
 *   added here; either would be a duplicate.
 * - **Not owned.** The router never sees the URL, so `buildLegacyHref` localizes
 *   it with the same Stage 3 rule and points it at the legacy origin.
 *
 * Search parameters and hashes survive both branches untouched.
 *
 * ## Every prop of an anchor, not just three
 *
 * Widened from `{ children, className, href }` for the shared auth screens,
 * which put a link inside a Base UI `render`: that clones the element with the
 * children, the class name *and the ref* it needs to stay a button, so a wrapper
 * accepting only three props would silently drop two of them. The type is now
 * structurally `AuthLinkProps` from `@vitnode/core/views/auth/auth-link`, which
 * is what lets this component be handed straight to `SignInContent`,
 * `SignInFormContent` and `SSOCallbackContent` as their `LinkComponent`.
 */
export type MigrationLinkProps = Omit<React.ComponentProps<'a'>, 'href'> & {
  href: string
}

export const MigrationLink = ({
  children,
  href,
  ...props
}: MigrationLinkProps) => {
  const router = useRouter()
  const locale = useLocale()

  if (isTanStackOwnedPath(router, href)) {
    return (
      <Link {...props} to={href}>
        {children}
      </Link>
    )
  }

  return (
    <a
      {...props}
      href={buildLegacyHref({ href, legacyOrigin: legacyWebOrigin(), locale })}
    >
      {children}
    </a>
  )
}
