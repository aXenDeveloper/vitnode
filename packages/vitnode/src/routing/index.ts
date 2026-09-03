/**
 * Plugin routing, as VitNode data - `@vitnode/core/routing`.
 *
 * A plugin says "I have a page called `hello`, it lives at `/example/hello`,
 * these are the strings it renders, and this module renders it". This layer
 * turns every such declaration in an application into one validated,
 * deterministically ordered manifest and the tree that manifest describes, and
 * stops there - it renders nothing, resolves no modules and imports nothing
 * framework-shaped.
 *
 * That boundary is the whole point, and it is the reason this package can be
 * read by a Next.js build, a TanStack Start build and a bare `vitest` process
 * at the same time. `boundaries.test.ts` keeps it: nothing here imports anything
 * that is not its own file.
 *
 * ## Two halves, fetched at two different times
 *
 *     ./tree ./flatten ./manifest ./graph   WHAT routes exist, WHERE, WHICH shape
 *     ./module                              HOW one behaves once its chunk lands
 *
 * The first is a plugin's `routes.ts`: a nested tree of `page()`, `layout()` and
 * `index()` declarations, read before a single byte of a page's code is
 * downloaded - which is why the guard, the URL, the tree shape, the message
 * namespaces and the one eager `search` schema live there and not in the module.
 * The second is the contract each lazily imported page or layout module
 * satisfies, and it is a VitNode-owned shape rather than a re-exported router
 * type, so a plugin is coupled to VitNode and not to whichever router its host
 * happens to run.
 */
export { definePluginRoute } from "./authoring";
export type { PluginRouteErrorCode, PluginRouteErrorDetails } from "./errors";
export { PluginRouteError } from "./errors";
export type { FlatPluginRoute } from "./flatten";
export { flattenPluginRoutes, pluginRouteIdFor } from "./flatten";
export type { PluginRouteGraph, PluginRouteNode } from "./graph";
export { buildPluginRouteGraph, pluginRouteNamespaces } from "./graph";
export type { CompiledPluginRouteTrees } from "./manifest";
export {
  buildPluginRouteManifest,
  compilePluginRouteTrees,
  pluginRouteId,
} from "./manifest";
export type {
  CheckedPluginRouteModule,
  CheckedPluginRouteOptions,
  PluginRouteBreadcrumbProps,
  PluginRouteContext,
  PluginRouteHead,
  PluginRouteHeadArgs,
  PluginRouteLayoutModule,
  PluginRouteLoadArgs,
  PluginRouteModule,
  PluginRouteOptions,
  PluginRoutePageModule,
  PluginRoutePageProps,
  PluginRouteRobots,
} from "./module";
export { readPluginRouteModule } from "./module";
export {
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  MAX_NAMESPACES,
  namespaceProblem,
  normalizeNamespaceList,
} from "./namespaces";
export { comparePluginRoutes } from "./order";

export type { ParseRoutePathResult } from "./path";
export {
  formatRoutePath,
  parseRoutePath,
  relativeRouteSegments,
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
  toNextRoutePath,
  toTanStackRoutePath,
} from "./path";
export type {
  PluginRouteComponent,
  PluginRouteDeclaration,
  PluginRouteDeclarationSource,
  PluginRouteEagerComponentRejected,
  PluginRouteIndexOptions,
  PluginRouteLayoutOptions,
  PluginRouteLazyComponent,
  PluginRoutePageOptions,
  PluginRoutes,
  PluginRouteSearchSchema,
} from "./tree";
export {
  definePluginRoutes,
  index,
  isPluginRouteDeclaration,
  isPluginRouteLazyComponent,
  layout,
  lazy,
  page,
} from "./tree";
export type {
  PluginRoute,
  PluginRouteArea,
  PluginRouteKind,
  PluginRouteManifest,
  PluginRouteRequirement,
  PluginRouteSearchValidator,
  PluginRouteSegment,
  PluginRouteSource,
} from "./types";
export {
  PLUGIN_ROUTE_AREAS,
  PLUGIN_ROUTE_ID_SEPARATOR,
  PLUGIN_ROUTE_KINDS,
  PLUGIN_ROUTE_REQUIREMENTS,
} from "./types";
