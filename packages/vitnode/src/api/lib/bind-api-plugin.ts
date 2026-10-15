import type { PluginManifest } from "@/lib/plugin-manifest";

import type {
  BaseBuildModuleReturn,
  BuildModuleOptions,
  BuildModuleReturn,
} from "./module";
import type { BuildRouteConfig, BuildRouteOptions, Route } from "./route";

import { buildModule } from "./module";
import { buildRoute } from "./route";

export const bindApiPlugin = <const Plugin extends string>(
  manifest: Pick<PluginManifest<Plugin>, "id">,
) => ({
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
  buildRoute: <P extends string, R extends BuildRouteConfig<P>>(
    options: BuildRouteOptions<P, R>,
  ): Route<Plugin, R & { path: P }> =>
    buildRoute<Plugin, P, R>({ ...options, pluginId: manifest.id }),
});
