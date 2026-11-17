import type { RouteMcpOptions } from "./mcp/route-options";

const ROUTE_STAFF_PERMISSIONS = Symbol.for("vitnode.route.staffPermissions");

export const isAdminApiPath = (path: string): boolean =>
  /(^|\/)admin(\/|$)/.test(path);

/** A route guard's permission as plain data: the plugin is always resolved. */
export interface RouteStaffPermission {
  module: string;
  permission: string;
  plugin: string;
}

export interface RouteStaffPermissions {
  admin?: RouteStaffPermission;
  moderator?: RouteStaffPermission;
}

export const setRouteStaffPermissions = (
  route: object,
  permissions: RouteStaffPermissions,
): void => {
  Object.defineProperty(route, ROUTE_STAFF_PERMISSIONS, {
    enumerable: false,
    value: permissions,
  });
};

export const routeStaffPermissions = (
  route: unknown,
): RouteStaffPermissions | undefined =>
  typeof route === "object" && route !== null
    ? (route as Record<symbol, RouteStaffPermissions | undefined>)[
        ROUTE_STAFF_PERMISSIONS
      ]
    : undefined;

const ROUTE_MCP = Symbol.for("vitnode.route.mcp");

/**
 * Marks a built route as an MCP tool. `buildRoute` calls it for `mcp` in the
 * route definition; the Content Engine calls it for the generated routes a
 * plugin selected. Not part of the route config handed to OpenAPI.
 */
export const setRouteMcp = (route: object, options: RouteMcpOptions): void => {
  Object.defineProperty(route, ROUTE_MCP, {
    configurable: true,
    enumerable: false,
    value: options,
  });
};

/** The route's MCP options, or `undefined` when it is not exposed. */
export const routeMcp = (route: unknown): RouteMcpOptions | undefined =>
  typeof route === "object" && route !== null
    ? (route as Record<symbol, RouteMcpOptions | undefined>)[ROUTE_MCP]
    : undefined;
