/**
 * Plugin routing, as VitNode data.
 *
 * A plugin says "I have a page called `hello`, it lives at `/example/hello`, and
 * this module renders it". This layer turns every such declaration in an
 * application into one validated, deterministically ordered manifest, and stops
 * there - it renders nothing, resolves no modules and imports nothing
 * framework-shaped.
 *
 * That boundary is the whole point. The route trees plugins ship today are
 * *Next.js* route trees, copied file by file into an app's `src/app` by
 * `scripts/prepare-plugins-files.ts`, which is why a VitNode plugin currently
 * cannot contribute a page to an application that is not Next.js. Nothing here
 * replaces that yet: it is the parallel path, and both are live.
 */
export type { PluginRouteErrorCode, PluginRouteErrorDetails } from "./errors";
export { PluginRouteError } from "./errors";
export {
  buildPluginRouteManifest,
  comparePluginRoutes,
  pluginRouteId,
} from "./manifest";

export type { ParseRoutePathResult } from "./path";
export {
  formatRoutePath,
  parseRoutePath,
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
  toNextRoutePath,
  toTanStackRoutePath,
} from "./path";
export type {
  PluginRoute,
  PluginRouteArea,
  PluginRouteDefinition,
  PluginRouteManifest,
  PluginRouteSegment,
  PluginRouteSource,
} from "./types";
export { PLUGIN_ROUTE_AREAS, PLUGIN_ROUTE_ID_SEPARATOR } from "./types";
