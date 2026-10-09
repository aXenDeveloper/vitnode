export type { ContentRegistryLoader } from "../admin/content/registry-runtime";
export {
  configureContentRegistry,
  resetContentRegistry,
} from "../admin/content/registry-runtime";
export type {
  AdminRouteLoadContext,
  AuthenticatedRouteLoadContext,
  AuthenticatedState,
  RouteLoadContext,
} from "./authoring";
export {
  defineAdminRoute,
  defineAuthenticatedRoute,
  defineRoute,
  routeBreadcrumbGroup,
} from "./authoring";
export { fileRoutePaths } from "./collision";
export { PLUGIN_ROUTES_ROUTE_ID } from "./container";
export type {
  PluginRouteAreaRoutes,
  PluginRoutePageHead,
  PluginRoutesMountOptions,
} from "./mount";
// oxlint-disable-next-line typescript/no-deprecated
export { withPluginRoutes, withVitNodeRoutes } from "./mount";
export type { PluginRouteSpec } from "./specs";
export { pluginRouteSpecs } from "./specs";
