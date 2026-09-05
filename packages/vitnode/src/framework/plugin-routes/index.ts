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

export type { ResolvedPluginRoutesModule } from "./types.js";
