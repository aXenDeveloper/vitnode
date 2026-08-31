import type { AnyRoute } from "@tanstack/react-router";

import { joinPaths } from "@tanstack/react-router";

import { routeMatchKey, routeMatchKeyFromTanStackPath } from "@/routing";

import type { PluginRouteSpec } from "./specs";

import { PLUGIN_ROUTES_ROUTE_ID } from "./container";

/**
 * A route's declared `path` and `id`, whichever of the two it has.
 *
 * `RouteOptions` is a union - a route declares a `path` *or* an `id`, never both
 * - so neither field can be read off it directly even though every route object
 * carries one of them. Both are optional here for exactly that reason.
 */
export const declaredOptions = (
  route: AnyRoute,
): { id?: string; path?: string } => route.options;

/**
 * Every URL the host application's own route files already claim.
 *
 * Walked rather than read off the route tree's types, because a route's
 * `fullPath` is only computed once the router initialises it and this runs
 * before that.
 *
 * **Every route that declares a path claims one**, children or not. A TanStack
 * route can be a page *and* a layout - `discover.tsx` with a `discover/` folder
 * beside it renders at `/discover` and wraps everything under it - so treating a
 * route with children as "just a layout" would quietly hand `/discover` to a
 * plugin. A pathless route claims nothing, which is what pathless means: it
 * contributes no segment and answers no URL, only its children do.
 *
 * The plugin subtree is skipped, so this stays the app's own answer no matter
 * how many times the composition has run.
 */
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

/**
 * Refuses a plugin route that would answer a URL the application already
 * answers.
 *
 * `buildPluginRouteManifest` already rejects two *plugins* claiming one URL and
 * cannot see this case: it never knows which application it is being built for.
 * Without this the app would hold two routes matching one pathname and let the
 * router's own ranking pick, which is the "last route wins" outcome the manifest
 * layer exists to make impossible.
 *
 * Compared by **match key, not by text**, and that is the whole substance of
 * this function. `/users/$id` and `/users/:userId` are the same URL space
 * spelled two ways in two syntaxes, and a string comparison sees two different
 * strings:
 *
 *     app     /users/$id      -> /users/:   ┐ collide
 *     plugin  /users/:userId  -> /users/:   ┘
 *
 *     app     /users/new      -> /users/new ┐ do not collide - a router tells
 *     plugin  /users/:id      -> /users/:   ┘ static from dynamic
 *
 * Both sides go through the routing package's one key space: the plugin through
 * `routeMatchKey` over its parsed segments, the app through
 * `routeMatchKeyFromTanStackPath` over the string its router holds. Same rule as
 * plugin-vs-plugin, because it is the same function.
 *
 * **Every** plugin route is checked, including layouts and index routes, and
 * including nested ones - which is why the specs carry each route's canonical
 * *full* path rather than only the fragment it adds. A layout at `/settings`
 * beside an application's own `/settings` is two routes competing for one
 * subtree even though the layout claims no page of its own.
 *
 * The first application path to claim a key is the one named in the error - the
 * app's route files cannot collide with each other, so which one it is only
 * affects the message.
 */
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
