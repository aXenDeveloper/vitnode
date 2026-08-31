export type {
  CompiledPluginRoutes,
  CompilePluginRoutesOptions,
  PluginRouteCompilerSource,
} from "./compile.js";
export { compilePluginRoutes } from "./compile.js";
export {
  annotatePluginRouteError,
  PLUGIN_ROUTES_ERROR_PREFIX,
  withPluginRouteDiagnostics,
} from "./diagnostics.js";
export { generatePluginRouteRegistrySource } from "./generate.js";
export type { HostRoutePath } from "./host-routes.js";
export {
  assertNoHostRouteCollision,
  hostRoutePathsFromFiles,
} from "./host-routes.js";
export { generatePluginRouteManifestSource } from "./manifest-source.js";
export { assertPluginRouteRegistryParity } from "./parity.js";

export {
  assertPluginId,
  pluginIdsFromLoadedConfig,
  pluginRouteEntrySources,
  resolvePluginRouteModules,
  routeDeclarationsFromManifest,
  sortAndAssertUnique,
  toSingleQuotedLiteral,
} from "./resolve.js";
/**
 * The build-time compiler for the routes an app's configured plugins ship.
 *
 * Everything here is pure: plain declarations in, validated data or a source
 * string out. There is no `node:fs`, no package resolution and no framework -
 * the build tool that owns those (`@vitnode/core/framework/vite`) loads the app
 * config and each plugin's route manifest, checks that every entry really
 * resolves to a file, and writes what this returns. That split is what makes the
 * part which has to be *exactly* reproducible testable without a fixture app.
 *
 * `compilePluginRoutes` is the whole of it, and the reason it is one function
 * rather than a pipeline each host assembles: the two generated files are
 * written from **one resolved snapshot**. The manifest is built and validated
 * first, and the module registry is derived from it - so a route reaches an
 * `import()` only by having survived validation, under the id the manifest gave
 * it, and a disabled plugin cannot leave a stale route or a stale import behind
 * because both files are written from the list its routes are no longer in.
 *
 *     compilePluginRoutes
 *       ├─ buildPluginRouteManifest         @vitnode/core/routing validates
 *       ├─ assertNoHostRouteCollision       does a plugin shadow the app's own
 *       ├─ resolvePluginRouteModules        one import specifier per route
 *       ├─ assertPluginRouteRegistryParity  the two files describe one set
 *       ├─ generatePluginRouteManifestSource   the *what*
 *       └─ generatePluginRouteRegistrySource   the *how*
 *
 * What a route *means* - its URL, its shape in the tree, its guard, its message
 * namespaces - is not decided here. That is the plugin route manifest's contract,
 * `@vitnode/core/routing`, and this layer validates nothing a route says for
 * itself: it calls that one and adds only what a build knows and a manifest
 * cannot - which file each declaration came from, and which URLs the host
 * application already answers.
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
