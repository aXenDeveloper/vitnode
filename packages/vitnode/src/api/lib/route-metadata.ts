const ROUTE_STAFF_PERMISSIONS = Symbol.for("vitnode.route.staffPermissions");

export const isAdminApiPath = (path: string): boolean =>
  /(^|\/)admin(\/|$)/.test(path);

export interface RouteStaffPermissionRef {
  module: string;
  permission: string;
  plugin?: string;
}

export interface RouteStaffPermissions {
  admin?: RouteStaffPermissionRef;
  moderator?: RouteStaffPermissionRef;
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
