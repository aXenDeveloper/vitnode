import type { FrontendCliIntegration } from "@vitnode/api/framework/cli-integration";

import type { CompiledPluginRoutes } from "../plugin-routes";

import { compilePluginRoutes } from "../plugin-routes/compile";
import {
  pluginsFromLoadedConfig,
  routeDeclarationsFromRoutesModule,
} from "../plugin-routes/resolve";
import {
  assertComponentsImportable,
  configuredPluginIds,
} from "../vite/plugin-routes";

/**
 * Core's implementation of the `vitnode` CLI's frontend integration. The CLI
 * (in `@vitnode/api`) resolves this module from the project it runs in and
 * uses it for route checks and plugin discovery. Node only.
 */
export const frontendCliIntegration = {
  assertComponentsImportable,
  compilePluginRoutes,
  configuredPluginIds,
  pluginsFromLoadedConfig,
  routeDeclarationsFromRoutesModule,
} satisfies FrontendCliIntegration<CompiledPluginRoutes>;
