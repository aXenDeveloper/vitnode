import {
  fileRoutePaths,
  PLUGIN_ROUTES_ROUTE_ID,
} from '@vitnode/core/tanstack/plugin-routes'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { isTanStackOwnedPath } from '#/migration/navigation'
import { pluginRouteManifest } from '#/plugin-route-manifest.gen'
import { pluginRouteModules } from '#/plugin-routes.gen'
import { getRouter } from '#/router'

import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(here, '..')

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
   * Stage 11. A plugin's own hierarchy, as real parent and child routes.
   *
   * `/example/guide` is a `layout` and an index `page` at the same path - the
   * `layout.tsx` / `page.tsx` pair, said as manifest data - and `:topic` is a
   * dynamic child one segment deeper. What is asserted is that the router
   * matches them as a *chain*: the layout, then the page inside it. A flattened
   * subtree would match one route where there should be two, and the frame would
   * be drawn by each page rather than once around all of them.
   */
  it('matches a plugin layout and the page inside it as a chain', () => {
    const router = getRouter()
    const pluginRouteIds = (pathname: string) =>
      router
        .matchRoutes(pathname, undefined)
        .map((match) => match.routeId)
        .filter((id) => id.includes(`/${PLUGIN_ROUTES_ROUTE_ID}/`))

    // The layout claims no URL of its own, so `/example/guide` is answered by
    // the index route *inside* it - two matches, not one.
    expect(pluginRouteIds('/example/guide')).toEqual([
      `${MAIN_SHELL_ROUTE_ID}/${PLUGIN_ROUTES_ROUTE_ID}/example/guide`,
      `${MAIN_SHELL_ROUTE_ID}/${PLUGIN_ROUTES_ROUTE_ID}/example/guide/`,
    ])

    expect(pluginRouteIds('/example/guide/manifest')).toEqual([
      `${MAIN_SHELL_ROUTE_ID}/${PLUGIN_ROUTES_ROUTE_ID}/example/guide`,
      `${MAIN_SHELL_ROUTE_ID}/${PLUGIN_ROUTES_ROUTE_ID}/example/guide/$topic`,
    ])
  })

  /**
   * The dynamic segment is the router's, not a string the manifest wrote: a
   * plugin declares `:topic` and the runtime converts it, so the parameter
   * arrives in the loader under the name the plugin gave it.
   */
  it('parses a plugin route’s dynamic segment', () => {
    expect(
      getRouter().matchRoutes('/example/guide/namespaces', undefined).at(-1),
    ).toMatchObject({ params: { topic: 'namespaces' } })
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
    // Stage 11. A nested plugin subtree: the layout's index page, a dynamic
    // child, and a topic the plugin does not know - which is still this app's
    // route, because `:topic` matches any single segment.
    ['/example/guide', true],
    ['/pl/example/guide', true],
    ['/example/guide/manifest', true],
    ['/pl/example/guide/manifest', true],
    ['/example/guide/anything', true],
    // One segment too deep: the layout matches `/example/guide` and leaves the
    // rest unconsumed, exactly as `/settings/notifications` does.
    ['/example/guide/manifest/extra', false],
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

/**
 * Stage 12. Which shell a plugin page is framed by, as this app wires it.
 *
 * No plugin in this repository ships an AdminCP route yet, so there is nothing
 * mounted to look at - which is exactly why the wiring is worth pinning now. The
 * failure this guards against is silent and arrives later: an `admin` mount
 * point that was never passed, or quietly dropped, would leave the first plugin
 * to declare `area: "admin"` mounted on the public site, outside the admin
 * session guard and wearing the site header.
 *
 * `withPluginRoutes` refuses that rather than falling back, so the real symptom
 * would be a failed build - but a build that fails for the plugin's author, in
 * their app, is a poor place to discover that this app forgot a line.
 */
describe('the shells plugin routes mount under', () => {
  const routerSource = () => withoutComments(join(srcDir, 'router.tsx'))

  it('names a mount point for every area VitNode has', () => {
    const source = routerSource()

    expect(source).toMatch(/mountUnder:\s*\{[^}]*\badmin:\s*adminShellRoute\b/)
    expect(source).toMatch(/mountUnder:\s*\{[^}]*\bmain:\s*mainShellRoute\b/)
  })

  /**
   * The shells are route *objects* off the generated tree, not ids looked up by
   * string: `createFileRoute` produces one instance per module and
   * `routeTree.gen.ts` mutates it in place, so importing the module is what
   * makes the mount point the same object the router will hold.
   */
  it('takes both shells from the route modules themselves', () => {
    const source = routerSource()

    expect(source).toMatch(
      /import\s*\{\s*Route as adminShellRoute\s*\}\s*from\s*'\.\/routes\/_admin'/,
    )
    expect(source).toMatch(
      /import\s*\{\s*Route as mainShellRoute\s*\}\s*from\s*'\.\/routes\/_main'/,
    )
  })

  /**
   * Both shells have a plugin subtree, because `@vitnode/example` ships a page
   * in each area - and the AdminCP's is the whole of what Stage 12's `area:
   * "admin"` amounts to at runtime. A container appearing under a shell without
   * a manifest entry to explain it would mean the composition ran on something
   * this app did not declare; a container *missing* under `_admin` while the
   * manifest declares an admin route would mean the area was silently ignored.
   */
  it('has a plugin subtree in each shell a plugin declared a page for', () => {
    // Widened deliberately. The generated file is a `satisfies` literal, so
    // `area` narrows to the areas actually installed, which would make a
    // comparison against an absent one a type error rather than a false answer.
    const areas: string[] = pluginRouteManifest.map((route) => route.area)

    expect(areas).toContain('admin')
    expect(areas).toContain('main')

    const shells = (getRouter().routeTree.children ?? []) as {
      children?: { id?: string }[]
      id?: string
    }[]
    const containersUnder = (routeId: string) =>
      (shells.find((shell) => shell.id === routeId)?.children ?? []).filter(
        (child) => child.id?.endsWith(`/${PLUGIN_ROUTES_ROUTE_ID}`),
      )

    expect(containersUnder(MAIN_SHELL_ROUTE_ID)).toHaveLength(1)
    expect(containersUnder('/_admin')).toHaveLength(1)
  })

  /**
   * The representative admin route, end to end through this app's own wiring.
   *
   * Everything between a plugin's declaration and a URL is generated or
   * composed, and every step of it is invisible until the last one fails. So
   * each is named: the manifest entry says `admin` and spells the URL in full,
   * the registry has a literal import for the same route id, and the route ends
   * up under `_admin` rather than under the public shell - which is what puts
   * the session guard, the sidebar and the breadcrumb around it.
   */
  it('mounts the example plugin admin page under the AdminCP shell', () => {
    const declared = pluginRouteManifest.find(
      (route) => route.id === '@vitnode/example:admin-overview',
    )

    expect(declared).toMatchObject({
      area: 'admin',
      kind: 'page',
      // The area chose the shell; the `/admin` came from the path.
      path: '/admin/example',
    })
    expect(Object.keys(pluginRouteModules)).toContain(
      '@vitnode/example:admin-overview',
    )

    const shells = (getRouter().routeTree.children ?? []) as {
      children?: { children?: { id?: string; path?: string }[]; id?: string }[]
      id?: string
    }[]
    const adminContainer = (
      shells.find((shell) => shell.id === '/_admin')?.children ?? []
    ).find((child) => child.id?.endsWith(`/${PLUGIN_ROUTES_ROUTE_ID}`))

    // The router trims the leading slash off a non-root route's own `path` when
    // it initialises the tree; the URL it composes to is asserted below.
    expect((adminContainer?.children ?? []).map((child) => child.path)).toEqual(
      ['admin/example'],
    )
  })

  /**
   * And the boundary is untouched by any of it: an admin *plugin* route is one
   * URL, not a claim on the area.
   *
   * Stage 13 moved `/admin/content/*` into this router, so ownership is no
   * longer what separates the two - both are owned now. What still separates
   * them is *which route serves them*, and that is what this asserts: a content
   * URL is served by the Content Engine's own splat and never by the plugin
   * container, which would otherwise be a plugin quietly answering for every
   * content type in the installation.
   */
  it('serves no part of the Content Engine URLs', () => {
    const router = getRouter()
    const matchedIds = (pathname: string): string[] =>
      router.matchRoutes(pathname, undefined).map((match) => match.routeId)

    expect(isTanStackOwnedPath(router, '/admin/example')).toBe(true)
    expect(matchedIds('/admin/example')).toContain(
      `/_admin/${PLUGIN_ROUTES_ROUTE_ID}/admin/example`,
    )

    for (const pathname of ['/admin/content', '/admin/content/blog/posts']) {
      expect(matchedIds(pathname)).toContain('/_admin/admin/content/$')
      expect(
        matchedIds(pathname).some((id) => id.includes(PLUGIN_ROUTES_ROUTE_ID)),
        pathname,
      ).toBe(false)
    }
  })
})
