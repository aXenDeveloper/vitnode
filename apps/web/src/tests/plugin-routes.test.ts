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
  ])('answers %s as owned: %s', (href, owned) => {
    expect(isTanStackOwnedPath(getRouter(), href)).toBe(owned)
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
