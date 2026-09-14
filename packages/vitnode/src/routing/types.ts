export type PluginRouteArea = "admin" | "blank" | "main";

export const PLUGIN_ROUTE_AREAS: PluginRouteArea[] = ["admin", "blank", "main"];

export type PluginRouteKind = "layout" | "page";

/** Every kind a route may declare. */
export const PLUGIN_ROUTE_KINDS: PluginRouteKind[] = ["layout", "page"];

export type PluginRouteRequirement = "admin-guest" | "authenticated" | "guest";

/** Every requirement a route may declare. */
export const PLUGIN_ROUTE_REQUIREMENTS: PluginRouteRequirement[] = [
  "admin-guest",
  "authenticated",
  "guest",
];

export const PLUGIN_ROUTE_ID_SEPARATOR = ":";

/**
 * One parsed segment of a canonical VitNode route path.
 *
 * A `splat` swallows every remaining segment and may only be the last one, which
 * is what separates it from a `param`: `/admin/content/*` matches
 * `/admin/content/a/b`, and `/admin/content/:id` does not.
 */
export type PluginRouteSegment =
  | { kind: "param"; name: string }
  | { kind: "splat" }
  | { kind: "static"; value: string };

export type PluginRouteSearchValidator = (
  input: Record<string, unknown>,
) => unknown;

export interface PluginRoute {
  area: PluginRouteArea;
  /** Globally unique, `"<pluginId>:<routeId>"`. */
  id: string;
  kind: PluginRouteKind;
  /** Declared message namespaces, de-duplicated and sorted. Empty if none. */
  messages: string[];

  parentId: null | string;
  /** Canonical path, normalised (no trailing slash). */
  path: string;
  pluginId: string;
  /** As declared. `null` means the route is offered to everybody. */
  requires: null | PluginRouteRequirement;
  /**
   * The plugin-local half of {@link PluginRoute.id}, derived by VitNode from the
   * route's kind and its full path while the tree was flattened.
   */
  routeId: string;
  /** `path`, already parsed - so nothing downstream has to parse it again. */
  segments: PluginRouteSegment[];
}

export type PluginRouteManifest = PluginRoute[];

export interface PluginRouteSource {
  pluginId: string;
  routes?: unknown;
}
