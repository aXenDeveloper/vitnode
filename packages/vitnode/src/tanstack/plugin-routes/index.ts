/**
 * Plugin pages, as real routes in a TanStack Start application's route tree -
 * `@vitnode/core/tanstack/plugin-routes`.
 *
 * An application hands the two generated files to {@link pluginRouteSpecs} and
 * the result to {@link withPluginRoutes}, and that is the whole of its
 * plugin-routing code:
 *
 *     const routeTree = withPluginRoutes(
 *       fileRouteTree,
 *       pluginRouteSpecs(pluginRouteManifest, pluginRouteModules),
 *       {
 *         mountUnder: { admin: adminShellRoute, main: mainShellRoute },
 *         pageHead,
 *       },
 *     )
 *
 * `mountUnder` is one route per shell, because that is all an `area` declaration
 * ever meant: a plugin page framed by the public site or by the AdminCP, and in
 * a router a frame is a parent. An area the host does not name is refused rather
 * than mounted somewhere else.
 *
 * Everything else is here, because the composition is identical in every
 * installation: the graph, the lazy import, the message provider, the guard, the
 * metadata, the breadcrumb and the refusal to shadow one of the host's own
 * pages.
 *
 *     ./specs        the manifest and the registry, joined and read as a tree
 *     ./module-ref   one memoised, checked import per route
 *     ./mount        that tree, as TanStack routes
 *     ./components   what renders once a module has arrived
 *     ./guard        who a route is offered to, decided before its chunk loads
 *     ./head         a plugin's metadata, on the way into the host's own rule
 *     ./collision    what the application already owns, and the refusal
 *
 * What is deliberately absent: a locale, a shell, a data layer and an auth
 * store. `/example` and `/pl/example` are one route because the rewrite strips
 * the prefix before matching; the header and the `<main>` come from the route
 * this subtree is mounted under; a loader reads through the host's QueryClient
 * to the same Hono API every other page does; and the session is the one cache
 * entry Stage 6 already defined.
 */
export { fileRoutePaths } from "./collision";
export { PLUGIN_ROUTES_ROUTE_ID } from "./container";
export type {
  PluginRouteAreaRoutes,
  PluginRoutePageHead,
  PluginRoutesMountOptions,
} from "./mount";
export { withPluginRoutes } from "./mount";
export type { PluginRouteSpec } from "./specs";
export { pluginRouteSpecs } from "./specs";
