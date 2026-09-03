import type {
  PluginRoute,
  PluginRouteDeclarationSource,
  PluginRouteNode,
  PluginRouteSearchValidator,
} from "@/routing";

import {
  buildPluginRouteGraph,
  compilePluginRouteTrees,
  normalizeNamespaceList,
  pluginRouteNamespaces,
  toTanStackRoutePath,
} from "@/routing";

import type { PluginRouteModuleRef } from "./module-ref";

import { GLOBAL_NAMESPACE } from "../i18n/query";
import { pluginRouteModuleRef } from "./module-ref";

/**
 * One plugin route, as everything the router construction needs and nothing it
 * has to work out for itself.
 *
 * Pure data plus one memoised loader, derived from the plugins' own route trees
 * by {@link pluginRouteSpecs}. Everything here is decided *before* a single byte
 * of a plugin's page is fetched, which is the whole reason a tree and its
 * modules are two different things: the path a route claims, the parent it hangs
 * from, the strings it needs and the visitor it is offered to are all answers the
 * runtime must have in order to decide whether to fetch the chunk at all.
 *
 * The one thing that is *not* here is behaviour. A `head`, a `load`, a
 * `breadcrumb` and a `parseSearch` live in the lazily imported module and arrive
 * with it - see `./module-ref`.
 */
export interface PluginRouteSpec {
  /**
   * This route claims exactly its parent layout's URL - it is that layout's
   * index route, and its {@link PluginRouteSpec.path} is `"/"`.
   */
  isIndex: boolean;
  /** The memoised, checked import of this route's module. */
  module: PluginRouteModuleRef;
  /**
   * The exact namespace list this route's loader warms and its provider mounts,
   * or empty when it needs none.
   *
   * Its own `messages` plus every layout's above it, because a route's provider
   * *replaces* the shell's rather than adding to it - a page inside a layout
   * that declared `@vitnode/blog` renders the layout's frame too, and would lose
   * those strings by naming only its own.
   *
   * `core.global` is added by the runtime rather than by the plugin, for the
   * same reason: it is what every shared VitNode component translates through,
   * and a plugin author who forgot it would get a page of missing-message keys
   * with nothing to point at. Empty stays empty, though - a route that declares
   * no messages mounts no provider at all and reads the root's, which is
   * already exactly `core.global`.
   */
  namespaces: string[];
  /**
   * The **global** id of the plugin route this one is nested inside, or `null`
   * for one that hangs from the plugin container.
   */
  parentId: null | string;
  /**
   * This route's path in TanStack's spelling, **relative to its parent** -
   * `/blog/$slug` for a root, `/comments` for a child of `/blog/:slug`, and `/`
   * for a layout's index route.
   *
   * Relative because that is what a router composes, and it is the same form the
   * plugin author wrote: a nested route declares what it adds to its parent, and
   * `flattenPluginRoutes` is what turns that into the full canonical path a
   * collision can be seen in.
   */
  path: string;
  /** The manifest entry this spec was built from, unchanged. */
  route: PluginRoute;
  /**
   * This route's **eager** search schema, or `null` for the ordinary route that
   * declared none.
   *
   * The one thing on a spec that is a function rather than data, and the one
   * thing that could not wait for the module: a router's `validateSearch` runs
   * during path matching, before any chunk is fetched. A route earns it by
   * declaring `search` in its plugin's `routes.ts`, which is a module the host
   * imports statically - so by the time this spec exists the function is simply
   * here.
   */
  validateSearch: null | PluginRouteSearchValidator;
}

/**
 * The namespaces one route's provider mounts, given the tree it sits in.
 *
 * Exported for the tests, and separate from the loop below so the rule - "own
 * plus ancestors, plus the global set, or nothing at all" - can be stated on its
 * own.
 */
export const pluginRouteMessageNamespaces = (
  node: PluginRouteNode,
): string[] => {
  const declared = pluginRouteNamespaces(node);

  if (declared.length === 0) return [];

  return normalizeNamespaceList([GLOBAL_NAMESPACE, ...declared]);
};

/**
 * What a plugin route re-runs its loader for.
 *
 * A plugin route that declares no `search` registers no router-level
 * `validateSearch`, so the search a match carries is whatever was in the query
 * string. This turns that into something a match id can be built from without
 * depending on the order somebody happened to type the parameters in: `?b=2&a=1`
 * and `?a=1&b=2` are one page, and a route that treated them as two would re-run
 * its loader and remount its component every time a visitor swapped them.
 *
 * Keys sorted, `undefined` values dropped, prototype untouched -
 * `Object.fromEntries` defines own properties, so a `__proto__` parameter is an
 * own key here rather than a setter call.
 */
export const pluginRouteSearchDeps = (
  search: unknown,
): Record<string, unknown> => {
  if (typeof search !== "object" || search === null) return {};

  return Object.fromEntries(
    Object.entries(search as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1)),
  );
};

/**
 * Every configured plugin's route tree, read as the routes a router can mount.
 *
 * Two things happen here, and both are the last chance to catch a different
 * mistake:
 *
 * **The trees are flattened and validated.** `compilePluginRouteTrees` is the
 * same function the build ran over the same declarations - so the routes the
 * runtime mounts are provably the routes the build checked, and a plugin built
 * against an older VitNode fails here, naming the plugin, rather than becoming a
 * page that renders nothing.
 *
 * **Every path is converted once.** `:slug` in a declaration, `$slug` in the
 * router, and a child's path reduced to what it adds to its parent's.
 *
 * Pure apart from the memo each spec carries: no route is created, no page
 * module is imported, and nothing here knows what a router is.
 */
export const pluginRouteSpecs = (
  sources: readonly PluginRouteDeclarationSource[],
): PluginRouteSpec[] => {
  const { components, manifest, searchValidators } =
    compilePluginRouteTrees(sources);
  const graph = buildPluginRouteGraph(manifest);

  return graph.nodes.map(node => {
    const { route } = node;
    const component = components.get(route.id);

    if (!component) {
      throw new Error(
        `[VitNode plugin routes] Plugin route "${route.id}" has no component. Every route in a \`definePluginRoutes\` tree declares one, so this is a VitNode bug rather than something a plugin can cause.`,
      );
    }

    return {
      isIndex: node.isIndex,
      module: pluginRouteModuleRef(component.load, route.id),
      namespaces: pluginRouteMessageNamespaces(node),
      parentId: node.parent?.route.id ?? null,
      path: toTanStackRoutePath(
        node.parent === null ? route.segments : node.relativeSegments,
      ),
      route,
      validateSearch: searchValidators.get(route.id) ?? null,
    } satisfies PluginRouteSpec;
  });
};
