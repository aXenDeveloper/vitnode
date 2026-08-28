import type { AnyRouter } from '@tanstack/react-router'

import { useRouter } from '@tanstack/react-router'

import type { InternalDestination } from '#/lib/auth/redirects'
import type { Locale } from '#/lib/i18n/shared'

import { parseInternalDestination } from '#/lib/auth/redirects'
import { useLocale } from '#/lib/i18n/client'
import { localeRouting } from '#/lib/i18n/shared'
import { buildLegacyHref, legacyWebOrigin } from '#/lib/legacy-app'

/**
 * Going somewhere in VitNode from code, while half of VitNode still runs on
 * Next.js.
 *
 * `MigrationLink` answers this for a rendered link. This is the same rule for a
 * navigation nobody clicked - the one a sign-in performs when it is finished,
 * and the one the login page's guard performs for a visitor who is already
 * signed in. Both hand it a path a visitor supplied (`?returnTo=`), and during a
 * strangler migration most of those paths still belong to the other
 * application: `/settings/security`, `/blog/post-30`, `/files/...`. Handing one
 * of those to `router.navigate` routes it into *this* router, which has nothing
 * to match it with, and a working page becomes a TanStack not-found.
 *
 * ## Safe and owned are different questions
 *
 *     safe   - may this app send a browser here at all?   `sanitizeReturnTo`
 *     owned  - which application currently serves it?     `isTanStackOwnedPath`
 *
 * `/settings/security` is `safe: true, owned: false`, and that combination is
 * the normal case rather than an edge one. Nothing here relaxes the first
 * question to answer the second: a legacy navigation still begins from a
 * validated application-relative path, and the origin it is resolved against
 * comes from configuration, never from the URL.
 *
 * ## Deciding and doing are separate
 *
 * {@link migrationDestination} is pure - a path, an ownership answer, a locale
 * and an origin in; one of two destinations out. It has to be, because the same
 * decision is made in two environments that share no navigation API: a
 * `beforeLoad` running on the server, where the answer becomes an HTTP redirect,
 * and a click handler in the browser, where it becomes a router call. Only the
 * execution differs, and only the execution is environment-specific.
 *
 * There is deliberately no list of migrated routes here. The route tree is the
 * table - the same one `MigrationLink` reads - so a route migrated in a later
 * stage starts being navigated to client-side without this file changing.
 */

/** The API mount is not a page. */
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
 * and `/discover/anything` as a match on `/discover` - and under a
 * "matched.length > 0" rule both looked owned. That is not cosmetic: it hands a
 * page the Next.js app still serves to this router as a client-side navigation,
 * turning a working password reset into a TanStack not-found.
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
 * Where a validated internal path actually leads, and by which mechanism.
 *
 * - `tanstack` - a route this app renders. Carries the path split into the
 *   fields a router navigation takes, so the Stage 3 rewrite runs and writes the
 *   locale prefix exactly once.
 * - `legacy` - a route the Next.js app still serves. Carries a finished href,
 *   already localized and already pointed at the legacy origin, for a
 *   full-document navigation.
 */
export type MigrationDestination =
  | { destination: InternalDestination; type: 'tanstack' }
  | { href: string; type: 'legacy' }

/**
 * The decision, with nothing environment-specific in it.
 *
 * `isOwned` is passed in rather than computed, which is what keeps this pure:
 * answering it needs a live router, and this function is called from a
 * `beforeLoad` on the server as well as from the browser.
 *
 * The locale is applied on exactly one branch. A TanStack destination stays
 * un-prefixed and the router's `rewrite.output` adds it when the location is
 * built; a legacy href gets it from `buildLegacyHref`, which uses the same Stage
 * 3 rule and is idempotent. Prefixing here as well would produce `/pl/pl/...`.
 */
export const migrationDestination = ({
  href,
  isOwned,
  legacyOrigin,
  locale,
}: {
  href: string
  isOwned: boolean
  legacyOrigin?: string
  locale: Locale
}): MigrationDestination =>
  isOwned
    ? { destination: parseInternalDestination(href), type: 'tanstack' }
    : { href: buildLegacyHref({ href, legacyOrigin, locale }), type: 'legacy' }

/**
 * A {@link MigrationDestination} as options for `redirect()` or
 * `router.navigate()`, which take the same shape.
 *
 * `reloadDocument` is set explicitly on the legacy branch rather than left to be
 * inferred. An absolute href infers it on its own, but `buildLegacyHref`
 * legitimately returns a *relative* path when no legacy origin is configured -
 * the deployment where a proxy routes both apps by path - and inferring nothing
 * there would turn the one case that must leave this router into a client-side
 * navigation to a route it cannot render.
 */
export const migrationNavigateOptions = (destination: MigrationDestination) =>
  destination.type === 'legacy'
    ? { href: destination.href, reloadDocument: true }
    : destination.destination

/**
 * {@link migrationDestination}, against this deployment's configured legacy
 * origin.
 *
 * Still takes the ownership *answer* rather than a router, because the two
 * callers get it from different places: a click handler has a mounted router,
 * and a `beforeLoad` has `context.ownsPath` - the router's own answer, handed to
 * the route tree by `src/router.tsx` because `beforeLoad` receives no router.
 */
export const resolveMigrationDestination = ({
  href,
  isOwned,
  locale,
}: {
  href: string
  isOwned: boolean
  locale: Locale
}): MigrationDestination =>
  migrationDestination({
    href,
    isOwned,
    legacyOrigin: legacyWebOrigin(),
    locale,
  })

/**
 * Navigate to a validated internal path, wherever it is actually served.
 *
 * The browser half of the rule. `router.navigate` performs both branches - given
 * `reloadDocument` it does a full-document navigation, through the router's own
 * blocker and dangerous-protocol checks - so there is one call and no
 * `location.assign` reaching around the framework.
 */
export const useMigrationNavigate = () => {
  const router = useRouter()
  const locale = useLocale()

  return async (href: string): Promise<void> => {
    await router.navigate(
      migrationNavigateOptions(
        resolveMigrationDestination({
          href,
          isOwned: isTanStackOwnedPath(router, href),
          locale,
        }),
      ),
    )
  }
}
