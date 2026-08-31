import type { PluginRoute } from "../../routing/types.js";
import type { ResolvedPluginRouteModule } from "./types.js";

import { PLUGIN_ROUTES_ERROR_PREFIX } from "./diagnostics.js";

/**
 * The two generated files describe the same set of routes, or the build stops.
 *
 * `plugin-route-manifest.gen.ts` says *what* routes exist and
 * `plugin-routes.gen.ts` says *how* each one's module is imported, and the
 * runtime joins them by route id - so a route in one and not the other is a page
 * that either 404s or is bundled and never reachable. `pluginRouteSpecs` refuses
 * that at runtime, in the browser and in SSR, which is the right place for the
 * *last* line of defence and a terrible place for the first.
 *
 * This is the first. Both lists come from one resolved manifest in
 * {@link compilePluginRoutes} - the registry's entries are *derived* from the
 * manifest's routes rather than read from a second pass over the plugins - so
 * this check should be unfailable, and that is exactly why it is written down:
 * it is the assertion that keeps the derivation honest if somebody later gives
 * the registry its own source of truth back. Cheap, total, and it names the ids.
 *
 * Checked in three directions, because they are three different mistakes:
 *
 * - **Missing.** A manifest route with no module - the page has no code.
 * - **Orphaned.** A module with no manifest route - code nothing can reach, and
 *   a chunk in the bundle for a route that was removed.
 * - **Disagreeing.** Both sides have the id but describe different plugins,
 *   route ids or entries, which is the drift that would otherwise load one
 *   plugin's component for another plugin's URL.
 */
export const assertPluginRouteRegistryParity = (
  manifest: readonly PluginRoute[],
  modules: readonly ResolvedPluginRouteModule[],
): void => {
  const byKey = new Map(modules.map(module => [module.key, module]));
  const claimed = new Set(manifest.map(route => route.id));

  const missing = manifest
    .filter(route => !byKey.has(route.id))
    .map(route => route.id);

  if (missing.length > 0) {
    throw new Error(
      `${PLUGIN_ROUTES_ERROR_PREFIX} The route manifest has routes with no module in the registry: ${missing.join(", ")}. Both generated files are written from one resolved manifest, so this is a bug in the generator rather than something a plugin can cause.`,
    );
  }

  const orphaned = modules
    .filter(module => !claimed.has(module.key))
    .map(module => module.key);

  if (orphaned.length > 0) {
    throw new Error(
      `${PLUGIN_ROUTES_ERROR_PREFIX} The module registry has modules for routes that are not in the route manifest: ${orphaned.join(", ")}. Both generated files are written from one resolved manifest, so this is a bug in the generator rather than something a plugin can cause.`,
    );
  }

  const disagreeing = manifest
    .filter(route => {
      const module = byKey.get(route.id);

      return (
        module !== undefined &&
        (module.entry !== route.entry ||
          module.pluginId !== route.pluginId ||
          module.routeId !== route.routeId)
      );
    })
    .map(route => route.id);

  if (disagreeing.length > 0) {
    throw new Error(
      `${PLUGIN_ROUTES_ERROR_PREFIX} The route manifest and the module registry disagree about ${disagreeing.join(", ")}: the same route id describes a different plugin, route id or entry in each. Both generated files are written from one resolved manifest, so this is a bug in the generator rather than something a plugin can cause.`,
    );
  }
};
