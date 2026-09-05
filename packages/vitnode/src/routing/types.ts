export type PluginRouteArea = "admin" | "main";

export const PLUGIN_ROUTE_AREAS: PluginRouteArea[] = ["admin", "main"];

export type PluginRouteKind = "layout" | "page";

/** Every kind a route may declare. */
export const PLUGIN_ROUTE_KINDS: PluginRouteKind[] = ["layout", "page"];

export type PluginRouteRequirement = "authenticated" | "guest";

/** Every requirement a route may declare. */
export const PLUGIN_ROUTE_REQUIREMENTS: PluginRouteRequirement[] = [
  "authenticated",
  "guest",
];

export const PLUGIN_ROUTE_ID_SEPARATOR = ":";

/** One parsed segment of a canonical VitNode route path. */
export type PluginRouteSegment =
  { kind: "param"; name: string } | { kind: "static"; value: string };

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
