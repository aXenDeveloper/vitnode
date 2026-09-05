import type { AnyRoute } from "@tanstack/react-router";

import { joinPaths } from "@tanstack/react-router";

import { routeMatchKey, routeMatchKeyFromTanStackPath } from "@/routing";

import type { PluginRouteSpec } from "./specs";

import { PLUGIN_ROUTES_ROUTE_ID } from "./container";

export const declaredOptions = (
  route: AnyRoute,
): { id?: string; path?: string } => route.options;

export const fileRoutePaths = (routeTree: AnyRoute): string[] => {
  const walk = (route: AnyRoute, prefix: string): string[] => {
    const { id, path } = declaredOptions(route);

    if (id === PLUGIN_ROUTES_ROUTE_ID) return [];

    const declaresPath = typeof path === "string" && path.length > 0;
    const here = declaresPath ? joinPaths([prefix, path]) : prefix;
    const children: AnyRoute[] = route.children ?? [];

    return [
      ...(declaresPath ? [here] : []),
      ...children.flatMap(child => walk(child, here)),
    ];
  };

  return (routeTree.children ?? []).flatMap((child: AnyRoute) =>
    walk(child, "/"),
  );
};

export const assertNoAppCollision = (
  specs: readonly PluginRouteSpec[],
  appPaths: readonly string[],
): void => {
  const claimed = new Map<string, string>();

  for (const appPath of appPaths) {
    const key = routeMatchKeyFromTanStackPath(appPath);

    if (!claimed.has(key)) claimed.set(key, appPath);
  }

  for (const spec of specs) {
    const conflict = claimed.get(routeMatchKey(spec.route.segments));

    if (conflict === undefined) continue;

    throw new Error(
      `[VitNode plugin routes] Plugin route "${spec.route.id}" claims "${spec.route.path}", which conflicts with application route "${conflict}". Both match the same URLs, and VitNode will not let a router's ordering decide which one answers - rename the plugin's route.`,
    );
  }
};
