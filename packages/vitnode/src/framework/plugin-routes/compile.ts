import type { PluginRouteLazyComponent } from "../../routing/tree.js";
import type { PluginRouteManifest } from "../../routing/types.js";
import type { ContentUrlSource } from "./content-urls.js";
import type { HostRoutePath } from "./host-routes.js";
import type { LocaleRoutePathsConfig } from "./locale-route-paths.js";
import type { ResolvedPluginRoutesModule } from "./types.js";

import { compilePluginRouteTrees } from "../../routing/manifest.js";
import { assertContentUrlsHavePages } from "./content-urls.js";
import { withPluginRouteDiagnostics } from "./diagnostics.js";
import { generatePluginRoutesSource } from "./generate.js";
import { assertNoHostRouteCollision } from "./host-routes.js";
import { assertLocaleRoutePaths } from "./locale-route-paths.js";

/** One configured plugin, as the route compiler reads it. */
export interface PluginRouteCompilerSource {
  pluginId: string;
  /** The plugin's `routes` declaration, as `buildPlugin` received it. */
  routes?: unknown;

  /** The import specifier of the plugin's routes module, written into the generated file. */
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
  /** Plugins' public content URLs, each of which must be served by a page. */
  contentUrls?: readonly ContentUrlSource[];
  /** The app's own routes, which plugin routes must not collide with. */
  hostRoutes?: readonly HostRoutePath[];
  /** The app's `i18n` config, to validate translated route paths against. */
  i18n?: LocaleRoutePathsConfig;
  sources: readonly PluginRouteCompilerSource[];
}

/**
 * Compiles every configured plugin's routes into one manifest and the source
 * of the app's `src/plugin-routes.gen.ts`. Build tooling: the VitNode Vite
 * plugin and CLI call it; apps and plugins do not.
 *
 * @throws When a plugin's routes are invalid or collide with each other or the
 * app's routes, when translated route paths are invalid, or when a public
 * content URL has no page. Errors name the plugin's routes module.
 */
export const compilePluginRoutes = ({
  contentUrls = [],
  hostRoutes = [],
  i18n,
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

    if (i18n !== undefined) {
      assertLocaleRoutePaths({ hostRoutes, i18n, manifest });
    }

    assertContentUrlsHavePages({ contentUrls, hostRoutes, manifest });

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
