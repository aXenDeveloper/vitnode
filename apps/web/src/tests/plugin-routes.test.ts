import {
  fileRoutePaths,
  PLUGIN_ROUTES_ROUTE_ID,
} from '@vitnode/core/tanstack/plugin-routes'
import { describe, expect, it } from 'vitest'

import { isTanStackOwnedPath } from '#/migration/navigation'
import { pluginRouteManifest } from '#/plugin-route-manifest.gen'
import { pluginRouteModules } from '#/plugin-routes.gen'
import { getRouter } from '#/router'

/**
 * Plugin routes, as *this* application ships them.
 *
 * The composition itself - what a manifest and a registry become, and what a
 * collision does - is `@vitnode/core/tanstack/plugin-routes`' own test, against
 * fixtures. What is left here is the half a package cannot assert: that this
 * app's two generated files describe the plugins in `src/vitnode.config.ts`,
 * that they reach this app's router, and that the route tree they produce owns
 * exactly the URLs this app means to own and no others.
 */

/** The pathless route that renders the main application shell. */
const MAIN_SHELL_ROUTE_ID = '/_main'

describe("the app's real route tree", () => {
  /**
   * The exit criterion, asserted against what the app actually ships rather than
   * a fixture: the prototype plugin route is in the one route tree, and it got
   * there from the two generated files.
   */
  it('serves the example plugin’s page', () => {
    expect(pluginRouteManifest.map((route) => route.path)).toContain('/example')
    expect(Object.keys(pluginRouteModules)).toContain(
      '@vitnode/example:example-page',
    )

    const router = getRouter()

    expect(
      router.matchRoutes('/example', undefined).map((match) => match.routeId),
    ).toContain(`${MAIN_SHELL_ROUTE_ID}/${PLUGIN_ROUTES_ROUTE_ID}/example`)
  })

  /**
   * Stage 8. A plugin route declares `area: "main"`, and this is what that
   * declaration buys: the page renders inside the same shell `/discover` does -
   * the header, the breadcrumb area and the one `<main>` - because the plugin
   * container is a child of the `_main` route rather than of the root.
   *
   * Asserted as route *structure*, which is what decides it. Nothing renders
   * here; the parent chain is the whole claim.
   */
  it('renders the example plugin’s page inside the main shell', () => {
    const matched = getRouter()
      .matchRoutes('/example', undefined)
      .map((match) => match.routeId)

    expect(matched).toContain(MAIN_SHELL_ROUTE_ID)
    expect(matched.indexOf(MAIN_SHELL_ROUTE_ID)).toBeLessThan(
      matched.findIndex((id) => id.endsWith('/example')),
    )
  })

  /**
   * `MigrationLink` asks the route tree what this app owns and there is no
   * hand-written list of migrated routes - so registering a plugin route is all
   * it takes for the link to become a client-side navigation. Asserted through
   * the same helper the component calls, which is a plain function over a router.
   */
  it.each([
    ['/example', true],
    ['/pl/example', true],
    ['/example?from=search#top', true],
    ['/discover', true],
    ['/blog/post-30', false],
    ['/api/core/members', false],
    // Stage 6. `/login` is migrated, and so are its two siblings - none of them
    // nested under it, which is what keeps ownership a per-leaf answer.
    ['/login', true],
    ['/pl/login', true],
    ['/login/sso/google', true],
    // Stage 9. Registration and password recovery, both outside the main shell
    // and both non-nested siblings of `/login` - see `src/tests/auth-routes.test.ts`
    // for why recovery in particular must not sit under it.
    ['/register', true],
    ['/pl/register', true],
    ['/login/reset-password', true],
    ['/pl/login/reset-password', true],
    // The case owning `/login` most easily annexes by accident: a path below it
    // that nobody has migrated. `matchRoutes` answers with `/login` and leaves
    // the rest unconsumed - see the note below.
    ['/login/something-else', false],
    // Stage 7. `/search` is a plain route; `/files` is a page behind the
    // pathless `_authenticated` guard - which adds no URL segment - so owning it
    // must still be decided at `/files` and not at the boundary above it.
    ['/search', true],
    ['/pl/search', true],
    ['/files', true],
    ['/pl/files', true],
    // A data table never navigates without a query string, and `matchRoutes`
    // takes a pathname - so a table URL is the shape that would break if the
    // query were not stripped before matching.
    ['/files?orderBy=name&order=asc&first=20', true],
    // Stage 9. `/settings` is a nested *layout* route with an index child, and
    // each panel is a page two segments deep beneath it - so owning one is
    // decided at its own path, and neither the pathless guard above nor the
    // layout itself answers for it. `/settings` is owned because of the index
    // child, not because the layout matched.
    ['/settings', true],
    ['/pl/settings', true],
    ['/settings/overview', true],
    ['/settings/devices', true],
    ['/pl/settings/devices', true],
    ['/settings/security', true],
    ['/pl/settings/security', true],
    // The case a migrated `/settings` most easily annexes by accident: a panel
    // that does not exist. The layout matches `/settings` and leaves the rest
    // unconsumed, so a prefix-matching rule would hand a page the Next.js app
    // still serves to this router - see the `/login` note below for why that
    // distinction is load-bearing rather than decorative.
    ['/settings/notifications', false],
    ['/pl/settings/notifications', false],
  ])('answers %s as owned: %s', (href, owned) => {
    expect(isTanStackOwnedPath(getRouter(), href)).toBe(owned)
  })

  /**
   * Owning `/login` must not quietly annex the paths beneath it.
   *
   * If the SSO callback or the reset-password page were *children* of `/login`,
   * that route would match every path below it as a prefix, and `MigrationLink`
   * would hand a page the Next.js app still serves to this router as a
   * client-side navigation - a working page turning into a TanStack not-found.
   * All three are therefore non-nested siblings (`login.tsx`,
   * `login_.sso.$providerId.tsx`, `login_.reset-password.tsx`), which is what
   * these assertions pin: exact leaves, no shared parent.
   *
   * `/login/something-else` is the case that still exercises it now that both
   * real siblings are migrated - `matchRoutes` answers with the deepest
   * *ancestor* it can match and leaves the rest unconsumed, which is exactly why
   * `isTanStackOwnedPath` compares the matched pathname to the requested one
   * instead of counting matches.
   */
  it('keeps /login an exact match, so unmigrated paths under it stay legacy', () => {
    const router = getRouter()
    const deepest = (pathname: string) =>
      router.matchRoutes(pathname, undefined).at(-1) as {
        pathname: string
        routeId: string
      }

    // `/login` resolves to itself, having consumed the whole path.
    expect(deepest('/login')).toMatchObject({
      pathname: '/login',
      routeId: '/login',
    })

    // A path below it that no route declares resolves to `/login` - the route id
    // alone says "owned" here, and it is not.
    expect(deepest('/login/something-else')).toMatchObject({
      pathname: '/login',
      routeId: '/login',
    })
    expect(isTanStackOwnedPath(router, '/login/something-else')).toBe(false)
  })

  /**
   * The SSO callback must not sit behind the guest-only guard.
   *
   * By the time a provider redirects back, the API has minted its `--state-sso`
   * cookie and the visitor may already have been signed in by another tab. Under
   * `/login`'s guard, a signed-in visitor arriving with a valid `code` would be
   * redirected away before the exchange ran, abandoning a half-finished OAuth
   * round trip. Asserted as route *structure*, which is what decides it.
   */
  it('does not put the SSO callback under the login route', () => {
    expect(
      getRouter()
        .matchRoutes('/login/sso/google', undefined)
        .map((match) => match.routeId),
    ).not.toContain('/login')
  })

  /**
   * A plugin route must not be reachable at a URL nobody declared. `/pl/example`
   * works because Stage 3's rewrite strips the prefix before matching; an unknown
   * prefix reaches the route tree intact and matches nothing.
   */
  it('does not invent locale-prefixed routes of its own', () => {
    expect(isTanStackOwnedPath(getRouter(), '/xx/example')).toBe(false)
    expect(
      fileRoutePaths(getRouter().routeTree).some((path) =>
        path.includes('/pl/'),
      ),
    ).toBe(false)
  })
})
