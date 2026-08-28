import type { AnyRoute } from '@tanstack/react-router'
import type { PluginRouteModuleRegistry } from '@vitnode/core/framework/plugin-routes'
import type { PluginRoute } from '@vitnode/core/routing'

import { createRootRoute, createRoute } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { isTanStackOwnedPath } from '#/components/migration-link'
import {
  assertPluginRouteModule,
  fileRoutePaths,
  PLUGIN_ROUTES_ROUTE_ID,
  pluginRouteSpecs,
  withPluginRoutes,
} from '#/lib/plugin-routes'
import { pluginRouteManifest } from '#/plugin-route-manifest.gen'
import { pluginRouteModules } from '#/plugin-routes.gen'
import { getRouter } from '#/router'

/**
 * Plugin routes, from a plugin's declaration to a URL this app answers.
 *
 * Everything here is route *data*: what the two generated files say, what the
 * composition builds out of them, and what the resulting route tree claims to
 * own. Nothing renders - whether the plugin's page produces the right HTML is
 * the plugin's own business, and a component test would only assert that
 * `lazyRouteComponent` works.
 */

const route = (overrides: Partial<PluginRoute> = {}): PluginRoute => ({
  area: 'main',
  entry: 'routes/page',
  id: 'plugin:page',
  path: '/page',
  pluginId: 'plugin',
  routeId: 'page',
  segments: [{ kind: 'static', value: 'page' }],
  ...overrides,
})

const registryOf = (...keys: string[]): PluginRouteModuleRegistry =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      async () => Promise.resolve({ default: () => null }),
    ]),
  )

describe('pluginRouteSpecs', () => {
  it('pairs each route with its module and converts the path for TanStack', () => {
    const specs = pluginRouteSpecs(
      [
        route({
          id: 'plugin:article',
          path: '/blog/:slug',
          routeId: 'article',
          segments: [
            { kind: 'static', value: 'blog' },
            { kind: 'param', name: 'slug' },
          ],
        }),
      ],
      registryOf('plugin:article'),
    )

    expect(specs).toHaveLength(1)
    // `:slug` in the manifest, `$slug` in the router. Neither spelling is the
    // other's, which is the reason the conversion is a function and not a regex
    // written twice.
    expect(specs[0].path).toBe('/blog/$slug')
    expect(specs[0].route.path).toBe('/blog/:slug')
  })

  it('leaves an app with no plugin routes with nothing to register', () => {
    expect(pluginRouteSpecs([], {})).toEqual([])
  })

  it('rejects a manifest route the registry has no module for', () => {
    expect(() => pluginRouteSpecs([route()], {})).toThrow(/plugin:page/)
  })

  it('rejects a registry module no manifest route claims', () => {
    expect(() => pluginRouteSpecs([], registryOf('plugin:page'))).toThrow(
      /plugin:page/,
    )
  })
})

describe('assertPluginRouteModule', () => {
  it('accepts a module with a component as its default export', () => {
    const module = { default: () => null }

    expect(assertPluginRouteModule(module, 'plugin:page')).toBe(module)
  })

  it.each([
    ['no default export', {}],
    ['a default export that is not a component', { default: 'page' }],
    ['nothing at all', null],
  ])('rejects a module with %s', (_label, module) => {
    expect(() => assertPluginRouteModule(module, 'plugin:page')).toThrow(
      /plugin:page/,
    )
  })
})

describe('withPluginRoutes', () => {
  const appTree = () => {
    const root = createRootRoute()

    return root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/' }),
      createRoute({ getParentRoute: () => root, path: '/discover' }),
    ])
  }

  const pluginChildren = (tree: ReturnType<typeof appTree>) =>
    (tree.children ?? [])
      .filter(
        (child) =>
          (child.options as { id?: string }).id === PLUGIN_ROUTES_ROUTE_ID,
      )
      .flatMap((container) => container.children ?? [])
      .map((child) => (child.options as { path?: string }).path)

  it('mounts one route per plugin route, under the plugin container', () => {
    const tree = withPluginRoutes(
      appTree(),
      pluginRouteSpecs(
        [route({ path: '/example' })],
        registryOf('plugin:page'),
      ),
    )

    expect(pluginChildren(tree)).toEqual(['/page'])
    expect(fileRoutePaths(tree)).toEqual(['/', '/discover'])
  })

  it('leaves the app route tree alone when no plugin declares a route', () => {
    const tree = withPluginRoutes(appTree(), [])

    expect(pluginChildren(tree)).toEqual([])
    expect(tree.children).toHaveLength(2)
  })

  /**
   * The property that keeps a dev server honest. Vite re-evaluates the module
   * that composes the tree without re-evaluating `routeTree.gen.ts`, so the
   * composition runs more than once against the same root route object - and
   * `addChildren` replaces rather than appends only because the plugin subtree is
   * one identifiable child.
   */
  it('replaces the plugin subtree rather than appending a second copy', () => {
    const tree = appTree()
    const specs = pluginRouteSpecs([route()], registryOf('plugin:page'))

    withPluginRoutes(tree, specs)
    withPluginRoutes(tree, specs)

    expect(pluginChildren(tree)).toEqual(['/page'])
    expect(tree.children).toHaveLength(3)
  })

  /**
   * The manifest layer rejects two plugins claiming one URL and cannot see this
   * case - it does not know which application it is being built for.
   */
  it('refuses a plugin route that would shadow one of the app’s own pages', () => {
    expect(() =>
      withPluginRoutes(
        appTree(),
        pluginRouteSpecs(
          [
            route({
              path: '/discover',
              segments: [{ kind: 'static', value: 'discover' }],
            }),
          ],
          registryOf('plugin:page'),
        ),
      ),
    ).toThrow(/discover/)
  })
})

/**
 * Plugin-vs-application collisions, compared by the URLs a route matches rather
 * than by the text of its path.
 *
 * The two sides are written in different syntaxes and name their parameters
 * independently, so `/users/$id` and `/users/:userId` are the same route spelled
 * two ways - and a string comparison sees two different strings.
 */
describe('plugin ↔ application collisions', () => {
  const treeWith = (...paths: string[]) => {
    const root = createRootRoute()

    return root.addChildren(
      paths.map((path) => createRoute({ getParentRoute: () => root, path })),
    )
  }

  const mount = (
    tree: AnyRoute,
    path: string,
    segments: PluginRoute['segments'],
  ) =>
    withPluginRoutes(
      tree,
      pluginRouteSpecs([route({ path, segments })], registryOf('plugin:page')),
    )

  const param = (name: string) => ({ kind: 'param' as const, name })
  const staticSegment = (value: string) => ({ kind: 'static' as const, value })

  it.each([
    ['/users/$id', '/users/:userId', [staticSegment('users'), param('userId')]],
    [
      '/blog/$slug/comments',
      '/blog/:postId/comments',
      [staticSegment('blog'), param('postId'), staticSegment('comments')],
    ],
    ['/discover', '/discover', [staticSegment('discover')]],
  ] as const)(
    'refuses app %s against plugin %s',
    (appPath, pluginPath, segments) => {
      expect(() => mount(treeWith(appPath), pluginPath, [...segments])).toThrow(
        /conflicts with application route/,
      )
    },
  )

  it.each([
    ['/users/new', '/users/:id', [staticSegment('users'), param('id')]],
    [
      '/users/$id',
      '/users/new',
      [staticSegment('users'), staticSegment('new')],
    ],
    ['/discover', '/example', [staticSegment('example')]],
  ] as const)(
    'allows app %s beside plugin %s',
    (appPath, pluginPath, segments) => {
      expect(() =>
        mount(treeWith(appPath), pluginPath, [...segments]),
      ).not.toThrow()
    },
  )

  it('names the plugin route, its canonical path and the app route it hit', () => {
    let message = ''

    try {
      mount(treeWith('/users/$id'), '/users/:userId', [
        staticSegment('users'),
        param('userId'),
      ])
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain('plugin:page')
    expect(message).toContain('/users/:userId')
    expect(message).toContain('/users/$id')
  })
})

/**
 * What the application is understood to already claim.
 *
 * A TanStack route can be a page *and* a layout at once, so "has children" does
 * not mean "claims no URL" - and a pathless route claims nothing by definition.
 */
describe('fileRoutePaths', () => {
  it('includes a route that has both a path and children', () => {
    const root = createRootRoute()
    const blog = createRoute({ getParentRoute: () => root, path: '/blog' })

    blog.addChildren([
      createRoute({ getParentRoute: () => blog, path: '/' }),
      createRoute({ getParentRoute: () => blog, path: '/$slug' }),
    ])

    expect(fileRoutePaths(root.addChildren([blog]))).toEqual([
      '/blog',
      '/blog/',
      '/blog/$slug',
    ])
  })

  it('does not let a pathless layout claim a URL', () => {
    const root = createRootRoute()
    const layout = createRoute({ getParentRoute: () => root, id: '_shell' })

    layout.addChildren([
      createRoute({ getParentRoute: () => layout, path: '/settings' }),
    ])

    expect(fileRoutePaths(root.addChildren([layout]))).toEqual(['/settings'])
  })

  it('excludes the plugin container and everything under it', () => {
    const tree = withPluginRoutes(
      (() => {
        const root = createRootRoute()

        return root.addChildren([
          createRoute({ getParentRoute: () => root, path: '/discover' }),
        ])
      })(),
      pluginRouteSpecs([route()], registryOf('plugin:page')),
    )

    expect(fileRoutePaths(tree)).toEqual(['/discover'])
  })

  /**
   * The regression the leaf-only walk allowed: a parent route that is also a
   * page could be claimed by a plugin.
   */
  it('protects a parent route that is also a page', () => {
    const root = createRootRoute()
    const blog = createRoute({ getParentRoute: () => root, path: '/blog' })

    blog.addChildren([
      createRoute({ getParentRoute: () => blog, path: '/$slug' }),
    ])

    expect(() =>
      withPluginRoutes(
        root.addChildren([blog]),
        pluginRouteSpecs(
          [
            route({
              path: '/blog',
              segments: [{ kind: 'static', value: 'blog' }],
            }),
          ],
          registryOf('plugin:page'),
        ),
      ),
    ).toThrow(/conflicts with application route/)
  })
})

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
    ).toContain(`/${PLUGIN_ROUTES_ROUTE_ID}/example`)
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
    // Stage 6. `/login` is migrated; the two auth routes nested *under* it are
    // not, and owning the parent must not make them look owned - see below.
    ['/login', true],
    ['/pl/login', true],
    ['/login/sso/google', true],
    ['/login/reset-password', false],
    ['/register', false],
    // Behind `_authenticated`, which is pathless: the guard adds no segment, so
    // the page is owned at its own path and the boundary is invisible here.
    ['/account', true],
  ])('answers %s as owned: %s', (href, owned) => {
    expect(isTanStackOwnedPath(getRouter(), href)).toBe(owned)
  })

  /**
   * Owning `/login` must not quietly annex the legacy routes beneath it.
   *
   * If the SSO callback were a *child* of `/login`, that route would match
   * `/login/reset-password` as a prefix too, and `MigrationLink` would hand a
   * page the Next.js app still serves to this router as a client-side
   * navigation - a working password reset turning into a TanStack not-found.
   * The callback is therefore a non-nested sibling
   * (`routes/login_.sso.$providerId.tsx`), which is what these two assertions
   * pin: two exact leaves, no shared parent.
   */
  it('keeps /login an exact match, so the legacy routes under it stay legacy', () => {
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

    // `/login/reset-password` resolves to `/login` as well - `matchRoutes`
    // answers with the deepest *ancestor* it can match and leaves the rest
    // unconsumed. Which is exactly why `isTanStackOwnedPath` compares the
    // matched pathname to the requested one instead of counting matches: the
    // route id alone says "owned" here, and it is not.
    expect(deepest('/login/reset-password')).toMatchObject({
      pathname: '/login',
      routeId: '/login',
    })
    expect(isTanStackOwnedPath(router, '/login/reset-password')).toBe(false)
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
