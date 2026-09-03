export type {
  CompiledPluginRoutes,
  CompilePluginRoutesOptions,
  PluginRouteCompilerSource,
} from "./compile.js";
export { compilePluginRoutes } from "./compile.js";
export { lazyImportSpecifier } from "./component-source.js";
export {
  annotatePluginRouteError,
  PLUGIN_ROUTES_ERROR_PREFIX,
  withPluginRouteDiagnostics,
} from "./diagnostics.js";
export { generatePluginRoutesSource } from "./generate.js";
export type { HostRoutePath } from "./host-routes.js";
export {
  assertNoHostRouteCollision,
  hostRoutePathsFromFiles,
} from "./host-routes.js";

export {
  assertPluginId,
  pluginIdsFromLoadedConfig,
  routeDeclarationsFromRoutesModule,
  sortAndAssertUniquePlugins,
  toSingleQuotedLiteral,
} from "./resolve.js";
/**
 * The build-time compiler for the routes an app's configured plugins ship.
 *
 * Everything here is pure: plain declarations in, validated data or a source
 * string out. There is no `node:fs`, no package resolution and no framework -
 * the build tool that owns those (`@vitnode/core/framework/vite`) loads the app
 * config and each plugin's `routes` module, and writes what this returns. That
 * split is what makes the part which has to be *exactly* reproducible testable
 * without a fixture app.
 *
 * `compilePluginRoutes` is the whole of it, and the reason it is one function
 * rather than a pipeline each host assembles: the generated file is written from
 * **one resolved snapshot**. The manifest is built and validated first, and the
 * file is written from the plugins that survived it - so a plugin reaches an
 * `import` only by having declared a tree that validates, and a disabled plugin
 * cannot leave a stale import behind because the file is written from the list it
 * is no longer in.
 *
 *     compilePluginRoutes
 *       ├─ compilePluginRouteTrees        @vitnode/core/routing flattens & validates
 *       ├─ assertNoHostRouteCollision     does a plugin shadow the app's own
 *       └─ generatePluginRoutesSource     one static import per plugin
 *
 * What a route *means* - its URL, its shape in the tree, its guard, its message
 * namespaces, the module it renders - is not decided here. That is the plugin
 * route tree's contract, `@vitnode/core/routing`, and this layer validates
 * nothing a route says for itself: it calls that one and adds only what a build
 * knows and a plugin cannot - which module each tree came from, and which URLs
 * the host application already answers.
 *
 * How a route is *registered* is the third thing, and belongs to whichever
 * router the app happens to run.
 */
export type { ResolvedPluginRoutesModule } from "./types.js";
