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

export interface PluginRouteSpec {
  /**
   * This route claims exactly its parent layout's URL - it is that layout's
   * index route, and its {@link PluginRouteSpec.path} is `"/"`.
   */
  isIndex: boolean;
  /** The memoised, checked import of this route's module. */
  module: PluginRouteModuleRef;

  namespaces: string[];
  /**
   * The **global** id of the plugin route this one is nested inside, or `null`
   * for one that hangs from the plugin container.
   */
  parentId: null | string;

  path: string;
  /** The manifest entry this spec was built from, unchanged. */
  route: PluginRoute;

  validateSearch: null | PluginRouteSearchValidator;
}

export const pluginRouteMessageNamespaces = (
  node: PluginRouteNode,
): string[] => {
  const declared = pluginRouteNamespaces(node);

  if (declared.length === 0) return [];

  return normalizeNamespaceList([GLOBAL_NAMESPACE, ...declared]);
};

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
