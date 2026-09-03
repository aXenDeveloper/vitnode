import type { PluginRouteLazyComponent } from "../../routing/tree.js";
import type { PluginRouteManifest } from "../../routing/types.js";
import type { HostRoutePath } from "./host-routes.js";
import type { ResolvedPluginRoutesModule } from "./types.js";

import { compilePluginRouteTrees } from "../../routing/manifest.js";
import { withPluginRouteDiagnostics } from "./diagnostics.js";
import { generatePluginRoutesSource } from "./generate.js";
import { assertNoHostRouteCollision } from "./host-routes.js";

/**
 * One configured plugin's route tree, exactly as its `routes` module exported
 * it.
 *
 * `routes` is `unknown` because a plugin is compiled JavaScript by the time it
 * is installed: every field is re-read defensively by `flattenPluginRoutes`.
 * What this layer adds is `routesSpecifier` - where the tree came from - which
 * is not part of what a plugin declares and is the one thing a plugin author
 * needs in order to fix any of these errors.
 */
export interface PluginRouteCompilerSource {
  pluginId: string;
  routes?: unknown;
  /**
   * The specifier the tree was loaded from, e.g. `"@vitnode/example/routes"`.
   * Optional so a caller with declarations from somewhere else - a test, or a
   * host reading a registered plugin - is not made to invent one.
   */
  routesSpecifier?: string;
}

/** What one compilation produced. */
export interface CompiledPluginRoutes {
  /**
   * Each route's lazy component, keyed by route id.
   *
   * Here so a build can ask the one question a generated file no longer answers
   * for it: does the module this page names actually exist. See
   * `lazyImportSpecifier`.
   */
  components: Map<string, PluginRouteLazyComponent>;
  /** The resolved snapshot the source below was written from. */
  manifest: PluginRouteManifest;
  /** The plugins whose route modules the generated file imports. */
  modules: ResolvedPluginRoutesModule[];
  /** The source of `src/plugin-routes.gen.ts`. */
  source: string;
}

export interface CompilePluginRoutesOptions {
  /**
   * Every URL the host application's own route files already claim.
   *
   * Empty by default, which is the honest answer for a caller that does not know
   * - a host with no file-based routes, or a test. The check it enables is a
   * build-time echo of one the runtime performs against the real route tree; see
   * {@link assertNoHostRouteCollision}.
   */
  hostRoutes?: readonly HostRoutePath[];
  sources: readonly PluginRouteCompilerSource[];
}

/**
 * Every configured plugin's routes, compiled into the one file an app holds.
 *
 * Pure: plain declarations in, a validated manifest and one source string out.
 * There is no filesystem here, no package resolution and no framework - the
 * build tool that owns those (`@vitnode/core/framework/vite`) loads the
 * declarations and writes what this returns. That split is what makes the part
 * that has to be *exactly* reproducible testable without a fixture app.
 *
 * ## One snapshot, one file
 *
 * The manifest is built first and the generated file is written **from the
 * plugins that survived it**, rather than from a second pass over the same
 * configuration. That ordering is the whole anti-drift argument: a plugin
 * reaches `plugin-routes.gen.ts` only by having declared a tree that validates,
 * and a plugin removed from the config cannot leave a stale import behind
 * because the file is written from the list it is no longer in.
 *
 * There is no second generated file to keep in step, and that is the point.
 * Every route's component is the `lazy()` the plugin's own tree carries, so the
 * route and the module it renders cannot describe different things - they are
 * one declaration.
 *
 * ## The order of the checks, which is the order of the diagnostics
 *
 * 1. `compilePluginRouteTrees` - is each route legal on its own, does the tree
 *    it sits in hold together, and do two of them claim one URL. Every failure
 *    names the plugin and the route; this layer adds the module each one was
 *    declared in.
 * 2. `assertNoHostRouteCollision` - does a plugin route shadow one of the
 *    application's own pages.
 *
 * Deterministic: the manifest is sorted by path and the generated file by plugin
 * id, both with code-unit comparisons, so the same plugin configuration produces
 * the same bytes on any machine and in any registration order.
 */
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
