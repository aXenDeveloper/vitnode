import type { AnyRoute } from '@tanstack/react-router'
import type {
  PluginRouteModuleLoader,
  PluginRouteModuleRegistry,
} from '@vitnode/core/framework/plugin-routes'
import type { PluginRoute } from '@vitnode/core/routing'

import {
  createRoute,
  joinPaths,
  lazyRouteComponent,
} from '@tanstack/react-router'
import {
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
  toTanStackRoutePath,
} from '@vitnode/core/routing'

/**
 * Plugin pages, in this app's route tree.
 *
 * Three inputs, and the whole point of the design is that each one answers
 * exactly one question:
 *
 *     plugin-route-manifest.gen.ts   what routes exist, at which VitNode path
 *     plugin-routes.gen.ts           how each route's module is imported
 *     this module                    how that becomes a TanStack route
 *
 * Both generated files are written by `vitnode-plugin-routes.ts` from the
 * plugins listed in `src/vitnode.config.ts` and the route manifest each of those
 * plugins ships. Neither of them mentions a router, and no plugin page is copied
 * into `src/routes` - the component stays compiled in the plugin's own `dist` and
 * arrives here as a lazy import the bundler resolved at build time.
 *
 * What is deliberately *not* here: a locale. `/example` and `/pl/example` are the
 * same route, because the router's rewrite strips the prefix before matching and
 * writes it back into every link (`lib/i18n/client.ts`). A plugin declares the
 * logical path and Stage 3 owns the public one, so there is nothing to prefix.
 */

/**
 * The pathless route every plugin page is mounted under.
 *
 * Pathless, so it contributes no URL segment: a plugin route at `/example` is
 * served at `/example`, not at `/_plugins/example`. It earns its place by making
 * the composition below **idempotent** - the plugin subtree is one child of its
 * mount point, identifiable by this id, so re-running the composition replaces
 * it instead of appending a second copy of every route. That is not a
 * theoretical concern: in dev, Vite re-evaluates this module without
 * re-evaluating `routeTree.gen.ts`, and the route it mutates is the same object.
 *
 * It also gives the whole plugin subtree one name in the router devtools, and
 * one place for a future stage to hang something every plugin page needs.
 */
export const PLUGIN_ROUTES_ROUTE_ID = '_plugins'

/**
 * What a plugin route module must export.
 *
 * A default export, because that is how every VitNode plugin page already
 * exports itself and it is the one name a generated registry can rely on without
 * being told.
 */
interface PluginRouteModule {
  default: React.FunctionComponent
}

/** One plugin route, paired with the loader that will fetch its component. */
export interface PluginRouteSpec {
  load: PluginRouteModuleLoader
  /** {@link PluginRoute.path} in TanStack's spelling: `/blog/$slug`. */
  path: string
  route: PluginRoute
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * A route's declared `path` and `id`, whichever of the two it has.
 *
 * `RouteOptions` is a union - a route declares a `path` *or* an `id`, never both
 * - so neither field can be read off it directly even though every route object
 * carries one of them. Both are optional here for exactly that reason.
 */
const declaredOptions = (route: AnyRoute): { id?: string; path?: string } =>
  route.options

/**
 * Checks that a loaded plugin route module actually exports a component.
 *
 * The registry's loaders are typed `() => Promise<unknown>` on purpose - what a
 * module is expected to export is not the registry's contract - so this is where
 * `unknown` becomes something React can render, and it is checked rather than
 * asserted. A plugin that exports the wrong thing gets a message naming itself;
 * without this the failure is React's "type is invalid" from inside a lazy
 * component, three frames away from the plugin that caused it.
 */
export const assertPluginRouteModule = (
  module: unknown,
  routeId: string,
): PluginRouteModule => {
  if (isRecord(module) && typeof module.default === 'function') {
    return module as unknown as PluginRouteModule
  }

  throw new Error(
    `[VitNode plugin routes] The module for plugin route "${routeId}" does not export a component as its default export. A plugin route module is \`export default MyPage\`.`,
  )
}

/**
 * The manifest and the registry, joined by route id.
 *
 * Both generated files key on the manifest layer's own `<pluginId>:<routeId>`,
 * so the join needs no translation - and checking it in **both** directions is
 * the point of doing it here rather than inline. They are written by one build
 * from one read of one manifest, so a route in one and not the other means the
 * two files are out of step, which is a stale generated file somebody committed
 * or a half-finished build. Either way it fails now, naming the route, instead of
 * becoming a 404 for a page that is definitely installed.
 */
export const pluginRouteSpecs = (
  manifest: readonly PluginRoute[],
  registry: PluginRouteModuleRegistry,
): PluginRouteSpec[] => {
  const specs = manifest.map((route) => {
    const load = registry[route.id]

    if (!load) {
      throw new Error(
        `[VitNode plugin routes] Plugin route "${route.id}" is in the route manifest but has no module in the registry. Regenerate \`src/plugin-routes.gen.ts\` - the two generated files are out of step.`,
      )
    }

    return { load, path: toTanStackRoutePath(route.segments), route }
  })

  const claimed = new Set(manifest.map((route) => route.id))
  const orphans = Object.keys(registry).filter((key) => !claimed.has(key))

  if (orphans.length > 0) {
    throw new Error(
      `[VitNode plugin routes] The registry has modules for routes that are not in the route manifest: ${orphans.join(', ')}. Regenerate \`src/plugin-route-manifest.gen.ts\` - the two generated files are out of step.`,
    )
  }

  return specs
}

/**
 * Every URL this app's own route files already claim.
 *
 * Walked rather than read off the route tree's types, because a route's
 * `fullPath` is only computed once the router initialises it and this runs
 * before that.
 *
 * **Every route that declares a path claims one**, children or not. A TanStack
 * route can be a page *and* a layout - `discover.tsx` with a `discover/` folder
 * beside it renders at `/discover` and wraps everything under it - so treating a
 * route with children as "just a layout" would quietly hand `/discover` to a
 * plugin. A pathless route claims nothing, which is what pathless means: it
 * contributes no segment and answers no URL, only its children do.
 *
 * The plugin subtree is skipped, so this stays the app's own answer no matter how
 * many times the composition has run.
 */
export const fileRoutePaths = (routeTree: AnyRoute): string[] => {
  const walk = (route: AnyRoute, prefix: string): string[] => {
    const { id, path } = declaredOptions(route)

    if (id === PLUGIN_ROUTES_ROUTE_ID) return []

    const declaresPath = typeof path === 'string' && path.length > 0
    const here = declaresPath ? joinPaths([prefix, path]) : prefix
    const children: AnyRoute[] = route.children ?? []

    return [
      ...(declaresPath ? [here] : []),
      ...children.flatMap((child) => walk(child, here)),
    ]
  }

  return (routeTree.children ?? []).flatMap((child: AnyRoute) =>
    walk(child, '/'),
  )
}

/**
 * Refuses a plugin route that would answer a URL this app already answers.
 *
 * `buildPluginRouteManifest` already rejects two *plugins* claiming one URL and
 * cannot see this case: it never knows which application it is being built for.
 * Without this the app would hold two routes matching one pathname and let the
 * router's own ranking pick, which is the "last route wins" outcome the manifest
 * layer exists to make impossible.
 *
 * Compared by **match key, not by text**, and that is the whole substance of this
 * function. `/users/$id` and `/users/:userId` are the same URL space spelled two
 * ways in two syntaxes, and a string comparison sees two different strings:
 *
 *     app     /users/$id      -> /users/:   ┐ collide
 *     plugin  /users/:userId  -> /users/:   ┘
 *
 *     app     /users/new      -> /users/new ┐ do not collide - a router tells
 *     plugin  /users/:id      -> /users/:   ┘ static from dynamic
 *
 * Both sides go through the routing package's one key space: the plugin through
 * `routeMatchKey` over its parsed segments, the app through
 * `routeMatchKeyFromTanStackPath` over the string its router holds. Same rule as
 * plugin-vs-plugin, because it is the same function.
 *
 * The first application path to claim a key is the one named in the error - the
 * app's route files cannot collide with each other, so which one it is only
 * affects the message.
 */
const assertNoAppCollision = (
  specs: PluginRouteSpec[],
  appPaths: string[],
): void => {
  const claimed = new Map<string, string>()

  for (const appPath of appPaths) {
    const key = routeMatchKeyFromTanStackPath(appPath)

    if (!claimed.has(key)) claimed.set(key, appPath)
  }

  for (const spec of specs) {
    const conflict = claimed.get(routeMatchKey(spec.route.segments))

    if (conflict === undefined) continue

    throw new Error(
      `[VitNode plugin routes] Plugin route "${spec.route.id}" claims "${spec.route.path}", which conflicts with application route "${conflict}". Both match the same URLs, and this app will not let a router's ordering decide which one answers - rename the plugin's route.`,
    )
  }
}

/**
 * Mounts the plugin routes on a route tree, and hands the same tree back.
 *
 * `addChildren` **replaces** a route's children and mutates the route in place,
 * so the plugin subtree is rebuilt from the mount point's current children with
 * any previous copy of itself removed. Calling this twice on one tree is
 * therefore the same as calling it once, which is what makes it safe in a dev
 * server that re-evaluates this module while `routeTree.gen.ts` stays cached.
 *
 * The route's component is a `lazyRouteComponent` over the registry's loader,
 * which is the supported way to code-split a code-based route: the plugin's page
 * gets its own Rollup chunk, stays out of the initial bundle, and the router
 * awaits `component.preload()` before it renders the match - so SSR and
 * hydration both have the module in hand rather than suspending on it.
 *
 * ## `mountUnder`
 *
 * Which route the subtree hangs from, defaulting to the tree's root - and the
 * only reason it is a parameter is the application shell. Every plugin route
 * declares `area: "main"` (see `@vitnode/core/routing`), which is a statement
 * about *layout*: this page belongs on the public site, with the header and the
 * breadcrumb area a page of the site has. In a router, a layout is a parent -
 * so honouring that declaration is choosing a parent, and `src/router.tsx`
 * passes the `_main` route.
 *
 * Nothing about the path changes: `_main` is pathless, so `/example` stays
 * `/example`. And the collision check below still walks the whole tree from its
 * root, because what a plugin route may not shadow is *any* URL the app answers,
 * wherever in the tree it was declared.
 */
export const withPluginRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  specs: PluginRouteSpec[],
  mountUnder: AnyRoute = routeTree,
): TRouteTree => {
  if (specs.length === 0) return routeTree

  assertNoAppCollision(specs, fileRoutePaths(routeTree))

  const container = createRoute({
    getParentRoute: () => mountUnder,
    id: PLUGIN_ROUTES_ROUTE_ID,
  })

  container.addChildren(
    specs.map((spec) =>
      createRoute({
        component: lazyRouteComponent(async () =>
          assertPluginRouteModule(await spec.load(), spec.route.id),
        ),
        getParentRoute: () => container,
        path: spec.path,
      }),
    ),
  )

  const siblings: AnyRoute[] = (mountUnder.children ?? []).filter(
    (child: AnyRoute) => declaredOptions(child).id !== PLUGIN_ROUTES_ROUTE_ID,
  )

  mountUnder.addChildren([...siblings, container])

  return routeTree
}
