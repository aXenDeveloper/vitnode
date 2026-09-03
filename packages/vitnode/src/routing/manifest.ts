import type { FlatPluginRoute } from "./flatten";
import type { PluginRouteLazyComponent } from "./tree";
import type {
  PluginRoute,
  PluginRouteManifest,
  PluginRouteSearchValidator,
  PluginRouteSource,
} from "./types";

import { PluginRouteError } from "./errors";
import { flattenPluginRoutes } from "./flatten";
import { buildPluginRouteGraph } from "./graph";
import { comparePluginRoutes } from "./order";
import { routeMatchKey } from "./path";
import { PLUGIN_ROUTE_ID_SEPARATOR } from "./types";

export { comparePluginRoutes };

/**
 * A route's globally unique id.
 *
 * Namespaced by the plugin, which is what lets two plugins both have a layout at
 * their own `/catalog` without either having to know the other exists.
 */
export const pluginRouteId = (pluginId: string, routeId: string): string =>
  `${pluginId}${PLUGIN_ROUTE_ID_SEPARATOR}${routeId}`;

/**
 * Every plugin route in an application, with the behaviour each one carries.
 *
 * The manifest is the data half - what routes exist, where, in which shape - and
 * the two maps are the halves that cannot be serialised: the lazy component of
 * each route, and the search schema of each route that declared one. All three
 * come out of one pass over one set of declarations, so a route cannot appear in
 * the manifest without its component or the other way round.
 */
export interface CompiledPluginRouteTrees {
  components: Map<string, PluginRouteLazyComponent>;
  manifest: PluginRouteManifest;
  searchValidators: Map<string, PluginRouteSearchValidator>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readPluginId = (source: unknown): string => {
  const pluginId = isRecord(source) ? source.pluginId : undefined;

  if (typeof pluginId !== "string" || !/^\S+$/.test(pluginId)) {
    throw new PluginRouteError(
      `A plugin registered routes without a plugin id (got ${JSON.stringify(pluginId)}).`,
      { code: "invalid-plugin-id", pluginId: "" },
    );
  }

  return pluginId;
};

const builtRoute = (pluginId: string, flat: FlatPluginRoute): PluginRoute => ({
  area: flat.area,
  id: pluginRouteId(pluginId, flat.routeId),
  kind: flat.kind,
  messages: flat.messages,
  parentId:
    flat.parentId === null ? null : pluginRouteId(pluginId, flat.parentId),
  path: flat.path,
  pluginId,
  requires: flat.requires,
  routeId: flat.routeId,
  segments: flat.segments,
});

/**
 * Every configured plugin's route tree, flattened, validated and ordered.
 *
 * Pure, and total in the only sense that matters: it either returns routes no
 * framework can misread, or it throws a {@link PluginRouteError} naming the
 * plugin, the route and - on a collision - both sides of it. There is no third
 * outcome where a route is quietly dropped, because a page that silently stops
 * existing is the failure mode this whole function is for.
 *
 * Three kinds of check, in three places, because they answer different
 * questions. `flattenPluginRoutes`: is each route legal on its own, and does the
 * tree it was written in make sense. Here: does any two of them claim one URL.
 * In `buildPluginRouteGraph`, which this calls last: does the hierarchy the
 * flattened list describes hold together.
 *
 * Registration order affects nothing but which plugin an error message calls
 * "first".
 */
export const compilePluginRouteTrees = (
  sources: readonly PluginRouteSource[],
): CompiledPluginRouteTrees => {
  const routes: PluginRoute[] = [];
  const components = new Map<string, PluginRouteLazyComponent>();
  const searchValidators = new Map<string, PluginRouteSearchValidator>();
  const byId = new Map<string, PluginRoute>();
  const byPath = new Map<string, PluginRoute>();

  for (const source of sources) {
    const pluginId = readPluginId(source);

    for (const flat of flattenPluginRoutes(pluginId, source.routes)) {
      const route = builtRoute(pluginId, flat);
      const existingById = byId.get(route.id);

      if (existingById) {
        throw new PluginRouteError(
          `Duplicate plugin route "${route.id}": ${pluginId} declares two ${route.kind}s at "${route.path}". Derived from the route's kind and its path, so two of them mean two routes claiming one URL - give one of them a different path.`,
          {
            code: "duplicate-id",
            conflictsWith: {
              pluginId: existingById.pluginId,
              routeId: existingById.id,
            },
            path: route.path,
            pluginId,
            routeId: route.id,
          },
        );
      }

      // Keyed on the URLs the route matches rather than on its text, so
      // `/blog/:slug` and `/blog/:postId` collide - they are one route spelled
      // twice.
      //
      // **`area` is deliberately not part of this key.** Both shells a host
      // mounts these under are *pathless* - `_main` and `_admin` contribute no
      // segment - so an area changes which frame draws the page and never which
      // URL it answers. `main /foo` and `admin /foo` are therefore one URL
      // claimed twice, and keying by area would have let the router's own
      // ranking decide which of them a browser reaches.
      //
      // Scoped by kind, and that is what nesting costs. A layout claims no URL,
      // so a layout at `/settings` and the index page inside it both spell
      // `/settings` and are not a collision - they are the two halves of one
      // screen. Two *pages* there still are one, and so are two layouts, which
      // would be two frames competing for one subtree.
      const pathKey = `${route.kind} ${routeMatchKey(route.segments)}`;
      const existingByPath = byPath.get(pathKey);

      if (existingByPath) {
        throw new PluginRouteError(
          `Plugin route path collision on "${route.path}" (${route.area}): ${existingByPath.pluginId} already owns "${existingByPath.path}" (${existingByPath.area}), and ${pluginId} declares "${route.path}". Both match the same URLs - a shell is pathless, so an area frames a page rather than moving it - and VitNode will not let a router's ordering decide which one answers. Give one of them a different path.`,
          {
            code: "duplicate-path",
            conflictsWith: {
              pluginId: existingByPath.pluginId,
              routeId: existingByPath.id,
            },
            path: route.path,
            pluginId,
            routeId: route.id,
          },
        );
      }

      byId.set(route.id, route);
      byPath.set(pathKey, route);
      routes.push(route);
      components.set(route.id, flat.component);

      if (flat.search !== null) searchValidators.set(route.id, flat.search);
    }
  }

  const manifest = routes.sort(comparePluginRoutes);

  // Last, and for its exceptions rather than for its result: a set of routes
  // whose hierarchy does not hold together is not a manifest, and the build has
  // to stop here rather than in a browser. The tree itself is rebuilt from this
  // list by whatever mounts it, with this same function.
  buildPluginRouteGraph(manifest);

  return { components, manifest, searchValidators };
};

/** {@link compilePluginRouteTrees}, for a caller that only needs the data. */
export const buildPluginRouteManifest = (
  sources: readonly PluginRouteSource[],
): PluginRouteManifest => compilePluginRouteTrees(sources).manifest;
