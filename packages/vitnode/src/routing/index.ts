export { definePluginRoute } from "./authoring";
export type { PluginRouteErrorCode, PluginRouteErrorDetails } from "./errors";
export { PluginRouteError } from "./errors";
export type { FlatPluginRoute } from "./flatten";
export { flattenPluginRoutes, pluginRouteIdFor } from "./flatten";
export type { PluginRouteGraph, PluginRouteNode } from "./graph";
export { buildPluginRouteGraph, pluginRouteNamespaces } from "./graph";
export type { CompiledPluginRouteTrees } from "./manifest";
export {
  buildPluginRouteManifest,
  compilePluginRouteTrees,
  pluginRouteId,
} from "./manifest";
export type {
  CheckedPluginRouteModule,
  CheckedPluginRouteOptions,
  PluginRouteBreadcrumbProps,
  PluginRouteContext,
  PluginRouteHead,
  PluginRouteHeadArgs,
  PluginRouteLayoutModule,
  PluginRouteLoadArgs,
  PluginRouteModule,
  PluginRouteOptions,
  PluginRoutePageModule,
  PluginRoutePageProps,
  PluginRouteRobots,
} from "./module";
export { readPluginRouteModule } from "./module";
export {
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  MAX_NAMESPACES,
  namespaceProblem,
  normalizeNamespaceList,
} from "./namespaces";
export { comparePluginRoutes } from "./order";

export type { ParseRoutePathResult } from "./path";
export {
  formatRoutePath,
  parseRoutePath,
  relativeRouteSegments,
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
  toNextRoutePath,
  toTanStackRoutePath,
} from "./path";
export type {
  PluginRouteComponent,
  PluginRouteDeclaration,
  PluginRouteDeclarationSource,
  PluginRouteEagerComponentRejected,
  PluginRouteIndexOptions,
  PluginRouteLayoutOptions,
  PluginRouteLazyComponent,
  PluginRoutePageOptions,
  PluginRoutes,
  PluginRouteSearchSchema,
} from "./tree";
export {
  definePluginRoutes,
  index,
  isPluginRouteDeclaration,
  isPluginRouteLazyComponent,
  layout,
  lazy,
  page,
} from "./tree";
export type {
  PluginRoute,
  PluginRouteArea,
  PluginRouteKind,
  PluginRouteManifest,
  PluginRouteRequirement,
  PluginRouteSearchValidator,
  PluginRouteSegment,
  PluginRouteSource,
} from "./types";
export {
  PLUGIN_ROUTE_AREAS,
  PLUGIN_ROUTE_ID_SEPARATOR,
  PLUGIN_ROUTE_KINDS,
  PLUGIN_ROUTE_REQUIREMENTS,
} from "./types";
