/** What the CLI reads from a compiled route table. */
export interface CompiledRoutesView {
  manifest: readonly {
    messages: readonly string[];
    path: string;
    pluginId: string;
  }[];
}

/**
 * The frontend half of the `vitnode` CLI: the route compiler and the app
 * config loader that `vitnode doctor`, `vitnode plugin validate` and plugin
 * discovery reuse instead of keeping copies.
 *
 * `@vitnode/core` implements it at `@vitnode/core/framework/cli`. The CLI ships
 * in `@vitnode/api` and resolves that entry from the project it runs in, so an
 * API-only project - which has no `@vitnode/core` and no routes - runs every
 * other command and reports the frontend checks as skipped. Node only.
 */
export interface FrontendCliIntegration<
  TCompiled extends CompiledRoutesView = CompiledRoutesView,
> {
  /** Throws when a compiled route's component cannot be imported from its plugin. */
  assertComponentsImportable: (
    compiled: TCompiled,
    routesFiles: ReadonlyMap<string, string>,
  ) => void;
  /** Compiles route declarations exactly as an app's Vite build does. */
  compilePluginRoutes: (args: {
    sources: {
      pluginId: string;
      routes: unknown[];
      routesSpecifier: string;
    }[];
  }) => TCompiled;
  /** The plugin ids an app's `src/vitnode.config.ts` configures, read by evaluating it. */
  configuredPluginIds: (appRoot: string) => Promise<string[]>;
  /** Validates the plugins of a loaded `vitnode.config` module; throws on the first problem. */
  pluginsFromLoadedConfig: (loaded: unknown, source: string) => unknown[];
  /** The route declarations a plugin's built `routes` module exports. */
  routeDeclarationsFromRoutesModule: (
    loaded: unknown,
    source: string,
  ) => unknown[];
}
