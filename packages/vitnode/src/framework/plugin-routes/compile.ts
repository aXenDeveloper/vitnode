import type {
  PluginRouteDefinition,
  PluginRouteManifest,
} from "../../routing/types.js";
import type { HostRoutePath } from "./host-routes.js";
import type { LegacyRoutePath } from "./legacy-routes.js";
import type { ResolvedPluginRouteModule } from "./types.js";

import { buildPluginRouteManifest } from "../../routing/manifest.js";
import { withPluginRouteDiagnostics } from "./diagnostics.js";
import { generatePluginRouteRegistrySource } from "./generate.js";
import { assertNoHostRouteCollision } from "./host-routes.js";
import { assertNoLegacyRouteCollision } from "./legacy-routes.js";
import { generatePluginRouteManifestSource } from "./manifest-source.js";
import { assertPluginRouteRegistryParity } from "./parity.js";
import {
  pluginRouteEntrySources,
  resolvePluginRouteModules,
} from "./resolve.js";

/**
 * One configured plugin's route declarations, exactly as its manifest exported
 * them.
 *
 * `routes` is typed but not trusted: a plugin is JavaScript by the time it is
 * installed, and every field is re-read defensively by
 * `buildPluginRouteManifest`. What this layer adds is `manifestSpecifier` -
 * where the declarations came from - which is not part of what a plugin declares
 * and is the one thing a plugin author needs to know to fix any of these errors.
 */
export interface PluginRouteCompilerSource {
  /**
   * The specifier the declarations were loaded from, e.g.
   * `"@vitnode/example/routes/manifest"`. Optional so a caller with declarations
   * from somewhere else - a test, a Next.js host reading a registered plugin -
   * is not made to invent one.
   */
  manifestSpecifier?: string;
  pluginId: string;
  routes?: readonly PluginRouteDefinition[];
}

/** What one compilation produced. */
export interface CompiledPluginRoutes {
  /** The resolved snapshot both sources below were written from. */
  manifest: PluginRouteManifest;
  /** The source of `src/plugin-route-manifest.gen.ts`. */
  manifestSource: string;
  /** The manifest's routes, paired with the specifiers they are imported by. */
  modules: ResolvedPluginRouteModule[];
  /** The source of `src/plugin-routes.gen.ts`. */
  registrySource: string;
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
  /**
   * URLs another application still answers, which a plugin route may not take.
   *
   * **Migration-only**, and empty by default so that every caller which does not
   * know about the Next.js half of the site is unaffected. See
   * `./legacy-routes`, which is the whole of the mechanism and is deleted at the
   * cutover along with this field.
   */
  legacyRoutes?: readonly LegacyRoutePath[];
  sources: readonly PluginRouteCompilerSource[];
}

/**
 * Every configured plugin's routes, compiled into the two files an app holds.
 *
 * Pure: plain declarations in, validated data and two source strings out. There
 * is no filesystem here, no package resolution and no framework - the build tool
 * that owns those (`@vitnode/core/framework/vite`) loads the declarations, checks
 * each entry resolves, and writes what this returns. That split is what makes
 * the part that has to be *exactly* reproducible testable without a fixture app.
 *
 * ## One snapshot, two files
 *
 * The manifest is built first and the registry is derived **from it**, rather
 * than from a second pass over the same plugins. That ordering is the entire
 * anti-drift argument: a route reaches `plugin-routes.gen.ts` only by being in
 * the manifest, under the id the manifest gave it, with the entry the manifest
 * validated. A route that fails validation cannot leave a stale import behind,
 * and a disabled plugin cannot leave one either, because both files are written
 * from the list its routes are no longer in.
 *
 * {@link assertPluginRouteRegistryParity} then checks in both directions anyway,
 * which is belt and braces on purpose: it is what keeps the derivation honest if
 * somebody later gives the registry its own source of truth back.
 *
 * ## The order of the checks, which is the order of the diagnostics
 *
 * 1. `buildPluginRouteManifest` - is each route legal on its own, do two of them
 *    claim one URL, and does the hierarchy they describe hold together. Every
 *    failure names the plugin and the route; this layer adds the manifest each
 *    one was declared in.
 * 2. `assertNoHostRouteCollision` - does a plugin route shadow one of the
 *    application's own pages.
 * 3. `assertNoLegacyRouteCollision` - does it take a URL the Next.js
 *    application still answers. Migration-only, and off unless a caller supplies
 *    the legacy routes.
 * 4. `resolvePluginRouteModules` - can each entry be written into an import.
 * 5. `assertPluginRouteRegistryParity` - do the two files describe one set of
 *    routes.
 *
 * Deterministic: the manifest is sorted by path and the registry by key, both
 * with code-unit comparisons, so the same plugin configuration produces the same
 * bytes on any machine and in any registration order.
 */
export const compilePluginRoutes = ({
  hostRoutes = [],
  legacyRoutes = [],
  sources,
}: CompilePluginRoutesOptions): CompiledPluginRoutes => {
  const manifestSpecifiers = new Map(
    sources.flatMap(source =>
      source.manifestSpecifier === undefined
        ? []
        : [[source.pluginId, source.manifestSpecifier] as const],
    ),
  );

  return withPluginRouteDiagnostics(manifestSpecifiers, () => {
    const manifest = buildPluginRouteManifest(
      sources.map(({ pluginId, routes }) => ({
        pluginId,
        routes: routes === undefined ? [] : [...routes],
      })),
    );

    assertNoHostRouteCollision(manifest, hostRoutes);
    assertNoLegacyRouteCollision(manifest, legacyRoutes);

    const modules = resolvePluginRouteModules(
      pluginRouteEntrySources(manifest),
    );

    assertPluginRouteRegistryParity(manifest, modules);

    return {
      manifest,
      manifestSource: generatePluginRouteManifestSource(manifest),
      modules,
      registrySource: generatePluginRouteRegistrySource(modules),
    };
  });
};
