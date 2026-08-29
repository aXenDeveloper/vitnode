import type {
  PluginRouteModuleLoader,
  PluginRouteModuleRegistry,
} from "@/framework/plugin-routes";
import type { PluginRoute, PluginRouteNode } from "@/routing";

import {
  buildPluginRouteGraph,
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
 * Pure data plus one memoised loader, derived from the two generated files by
 * {@link pluginRouteSpecs}. Everything here is decided *before* a single byte of
 * a plugin's code is fetched, which is the whole reason the manifest and the
 * module are two different things: the path a route claims, the parent it hangs
 * from, the strings it needs and the visitor it is offered to are all answers
 * the runtime must have in order to decide whether to fetch the chunk at all.
 *
 * The one thing that is *not* here is behaviour. A `head`, a `load` and a
 * `validateSearch` live in the module and arrive with it - see `./module-ref`.
 */
export interface PluginRouteSpec {
  /**
   * The route ids that may own this route's breadcrumb, deepest first.
   *
   * Its own id, then its layouts'. Stage 8's rule is "the deepest matched route
   * that declares a crumb wins", and inside a plugin subtree that cannot be
   * decided by `staticData` alone: whether a route declares a crumb is in its
   * *module*, which has not been fetched when `staticData` is written. So every
   * plugin route declares one crumb - a component that walks this chain at
   * render time, by which point the modules have arrived - and the rule comes
   * out the same as if each route had declared its own.
   */
  breadcrumbChain: string[];
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
   * Its own namespaces plus every layout's above it, because a route's provider
   * *replaces* the shell's rather than adding to it - a page inside a layout
   * that declared `@vitnode/blog` renders the layout's frame too, and would lose
   * those strings by naming only its own.
   *
   * `core.global` is added by the runtime rather than by the plugin, for the
   * same reason: it is what every shared VitNode component translates through,
   * and a plugin author who forgot it would get a page of missing-message keys
   * with nothing to point at. Empty stays empty, though - a route that declares
   * no namespaces mounts no provider at all and reads the root's, which is
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
   * Relative because that is what a router composes: a child's declared path is
   * joined to its parent's. The manifest spells every path out in full, which is
   * what makes a collision visible in a diff, and `buildPluginRouteGraph` is the
   * one place that turns the one form into the other.
   */
  path: string;
  /** The manifest entry this spec was built from, unchanged. */
  route: PluginRoute;
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

/** The ids that may own a route's crumb: its own, then its layouts', deepest first. */
const breadcrumbChainOf = (node: PluginRouteNode): string[] => {
  const chain: string[] = [];

  for (
    let current: null | PluginRouteNode = node;
    current !== null;
    current = current.parent
  ) {
    chain.push(current.route.id);
  }

  return chain;
};

/**
 * What a plugin route re-runs its loader for.
 *
 * A plugin route registers no `validateSearch` of its own - see
 * `./mount`, which explains why it cannot - so the search a match carries is
 * whatever was in the query string. This turns that into something a match id
 * can be built from without depending on the order somebody happened to type
 * the parameters in: `?b=2&a=1` and `?a=1&b=2` are one page, and a route that
 * treated them as two would re-run its loader and remount its component every
 * time a visitor swapped them.
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
 * The manifest and the registry, joined by route id and read as the tree they
 * describe.
 *
 * Three things happen here, and each of them is the last chance to catch a
 * different mistake:
 *
 * **The graph is rebuilt.** `buildPluginRouteGraph` is the same function that
 * validated the hierarchy while the app was built, run again over the generated
 * manifest - so the tree the runtime mounts is provably the tree the build
 * checked, and the parent of every route is decided in exactly one place. It
 * also returns the nodes **parents before children**, which is what lets the
 * construction below be a single pass with no lookahead.
 *
 * **The join is checked in both directions.** Both generated files key on the
 * manifest layer's own `<pluginId>:<routeId>`, so no translation is needed - and
 * a route in one file and not the other means the two are out of step, which is
 * a stale generated file somebody committed or a half-finished build. It fails
 * here, naming the route, rather than becoming a 404 for a page that is
 * definitely installed.
 *
 * **Every path is converted once.** `:slug` in the manifest, `$slug` in the
 * router, and a child's path reduced to what it adds to its parent's.
 *
 * Pure apart from the memo each spec carries: no route is created, no module is
 * imported, and nothing here knows what a router is.
 */
export const pluginRouteSpecs = (
  manifest: readonly PluginRoute[],
  registry: PluginRouteModuleRegistry,
): PluginRouteSpec[] => {
  const graph = buildPluginRouteGraph(manifest);

  const specs = graph.nodes.map(node => {
    const { route } = node;
    const load: PluginRouteModuleLoader | undefined = registry[route.id];

    if (!load) {
      throw new Error(
        `[VitNode plugin routes] Plugin route "${route.id}" is in the route manifest but has no module in the registry. Regenerate \`src/plugin-routes.gen.ts\` - the two generated files are out of step.`,
      );
    }

    return {
      breadcrumbChain: breadcrumbChainOf(node),
      isIndex: node.isIndex,
      module: pluginRouteModuleRef(load, route.id),
      namespaces: pluginRouteMessageNamespaces(node),
      parentId: node.parent?.route.id ?? null,
      path: toTanStackRoutePath(
        node.parent === null ? route.segments : node.relativeSegments,
      ),
      route,
    } satisfies PluginRouteSpec;
  });

  const claimed = new Set(manifest.map(route => route.id));
  const orphans = Object.keys(registry).filter(key => !claimed.has(key));

  if (orphans.length > 0) {
    throw new Error(
      `[VitNode plugin routes] The registry has modules for routes that are not in the route manifest: ${orphans.join(", ")}. Regenerate \`src/plugin-route-manifest.gen.ts\` - the two generated files are out of step.`,
    );
  }

  return specs;
};
