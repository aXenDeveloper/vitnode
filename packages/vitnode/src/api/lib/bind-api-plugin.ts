import type { PluginManifest } from "@/lib/plugin-manifest";

import type {
  BaseBuildModuleReturn,
  BuildModuleOptions,
  BuildModuleReturn,
} from "./module";
import type { BuildRouteConfig, BuildRouteOptions, Route } from "./route";

import { buildModule } from "./module";
import { buildRoute } from "./route";

/**
 * Binds the module and route builders to one plugin, so its routes carry the
 * plugin id - for OpenAPI tags, `c.get("plugin")`, staff-permission checks and
 * the fetcher's type inference - without repeating it.
 *
 * Call it once per plugin, in a builders module the plugin's API code imports.
 * Server-only.
 *
 * @example
 * ```ts
 * // src/api/builders.ts
 * import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
 *
 * import { manifest } from "@/manifest.gen";
 *
 * export const { buildModule, buildRoute } = bindApiPlugin(manifest);
 * ```
 */
export const bindApiPlugin = <const Plugin extends string>(
  manifest: Pick<PluginManifest<Plugin>, "id">,
) => ({
  /** {@link buildModule}, with this plugin's id filled in. */
  buildModule: <
    const M extends string,
    const Routes extends Route<Plugin>[],
    Modules extends BaseBuildModuleReturn<Plugin>[],
  >(
    options: BuildModuleOptions<Plugin, M, Routes, Modules>,
  ): BuildModuleReturn<Plugin, M, Routes, Modules> =>
    buildModule<Plugin, M, Routes, Modules>({
      ...options,
      pluginId: manifest.id,
    }),
  /** {@link buildRoute}, with this plugin's id filled in. */
  buildRoute: <P extends string, R extends BuildRouteConfig<P>>(
    options: BuildRouteOptions<P, R>,
  ): Route<Plugin, R & { path: P }> =>
    buildRoute<Plugin, P, R>({ ...options, pluginId: manifest.id }),
});
