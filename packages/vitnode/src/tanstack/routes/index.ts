export { CORE_ADMIN_ROUTES_ROUTE_ID, withCoreAdminRoutes } from "./admin";
export {
  CORE_AUTHENTICATED_ROUTES_ROUTE_ID,
  CORE_MAIN_ROUTES_ROUTE_ID,
  withCoreMainRoutes,
} from "./main";

export { CORE_ROOT_ROUTES_ROUTE_ID, withCoreRootRoutes } from "./root";
export type { CoreRootRouteContext, CoreRootRouteFactory } from "./root/types";
export type {
  CoreAdminRouteContext,
  CoreAuthRouteContext,
  CoreAuthRouteFactory,
  CorePageHead,
  CoreRouteContext,
  CoreRouteFactory,
} from "./types";
