import type { PluginRouteLazyComponent } from "../../routing/tree.js";
import type { PluginRouteManifest } from "../../routing/types.js";
import type { HostRoutePath } from "./host-routes.js";
import type { ResolvedPluginRoutesModule } from "./types.js";

import { compilePluginRouteTrees } from "../../routing/manifest.js";
import { withPluginRouteDiagnostics } from "./diagnostics.js";
import { generatePluginRoutesSource } from "./generate.js";
import { assertNoHostRouteCollision } from "./host-routes.js";

export interface PluginRouteCompilerSource {
  pluginId: string;
  routes?: unknown;

  routesSpecifier?: string;
}

/** What one compilation produced. */
export interface CompiledPluginRoutes {
  components: Map<string, PluginRouteLazyComponent>;
  /** The resolved snapshot the source below was written from. */
  manifest: PluginRouteManifest;
  /** The plugins whose route modules the generated file imports. */
  modules: ResolvedPluginRoutesModule[];
  /** The source of `src/plugin-routes.gen.ts`. */
  source: string;
}

export interface CompilePluginRoutesOptions {
  hostRoutes?: readonly HostRoutePath[];
  sources: readonly PluginRouteCompilerSource[];
}

export const compilePluginRoutes = ({
  hostRoutes = [],
  sources,
}: CompilePluginRoutesOptions): CompiledPluginRoutes => {
  const specifiers = new Map(
    sources.flatMap(source =>
      source.routesSpecifier === undefined
        ? []
        : [[source.pluginId, source.routesSpecifier] as const],
    ),
  );

  return withPluginRouteDiagnostics(specifiers, () => {
    const { components, manifest } = compilePluginRouteTrees(
      sources.map(({ pluginId, routes }) => ({ pluginId, routes })),
    );

    assertNoHostRouteCollision(manifest, hostRoutes);

    const modules: ResolvedPluginRoutesModule[] = sources.flatMap(source =>
      source.routesSpecifier === undefined
        ? []
        : [{ pluginId: source.pluginId, specifier: source.routesSpecifier }],
    );

    return {
      components,
      manifest,
      modules,
      source: generatePluginRoutesSource(modules),
    };
  });
};
