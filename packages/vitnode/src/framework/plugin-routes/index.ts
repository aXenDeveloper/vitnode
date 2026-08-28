export { generatePluginRouteRegistrySource } from "./generate.js";
export { generatePluginRouteManifestSource } from "./manifest-source.js";

export {
  assertPluginId,
  pluginIdsFromLoadedConfig,
  resolvePluginRouteModules,
  routeDeclarationsFromManifest,
  sortAndAssertUnique,
  toSingleQuotedLiteral,
} from "./resolve.js";
/**
 * Build-time discovery of the route modules an app's configured plugins ship.
 *
 * Everything here is pure: plain data in, validated data or a source string out.
 * There is no `node:fs`, no package resolution and no framework - a plugin route
 * is a package export subpath and a key, and turning those into imports a
 * bundler can follow is the whole job. The build tool that owns the filesystem
 * (`apps/web/vitnode-plugin-routes.ts`) loads the app config and the plugin
 * manifests, checks that each entry really resolves, and writes what
 * `generatePluginRouteRegistrySource` returns.
 *
 * What a route *means* - its URL, its loader, its metadata, its permissions -
 * is not decided here. That is the plugin route manifest's contract -
 * `@vitnode/core/routing` - and the registry generator deliberately reads only
 * `id` and `entry` off a `PluginRouteDefinition`, so the manifest can grow
 * without it changing. The one thing the two layers do share is the identifier:
 * a route's registry key is the manifest's own `pluginRouteId`, so a loader is
 * registered under exactly the id the manifest gave the route.
 *
 * There are therefore two generators here, and the split is the point:
 *
 * - `generatePluginRouteRegistrySource` - **how** each route's implementation is
 *   imported. One literal `import()` per route.
 * - `generatePluginRouteManifestSource` - **what** routes exist, as the
 *   framework-neutral manifest `@vitnode/core/routing` validated, frozen into
 *   the app at build time so nothing has to be validated again at runtime.
 *
 * How a route is *registered* is the third thing, and belongs to whichever
 * router the app happens to run.
 */
export type {
  PluginRouteEntryDeclaration,
  PluginRouteEntrySource,
  PluginRouteModuleLoader,
  PluginRouteModuleRegistry,
  ResolvedPluginRouteModule,
} from "./types.js";
