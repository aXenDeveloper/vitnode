export type PluginRouteErrorCode =
  | "childless-layout"
  | "conflicting-requires"
  | "cross-area-parent"
  | "cross-plugin-parent"
  | "duplicate-id"
  | "duplicate-path"
  | "eager-component"
  | "invalid-area"
  | "invalid-namespace"
  | "invalid-parent-kind"
  | "invalid-parent-path"
  | "invalid-path"
  | "invalid-plugin-id"
  | "invalid-requires"
  | "invalid-search"
  | "invalid-tree"
  | "malformed-route"
  | "parent-cycle"
  | "requires-in-admin-area"
  | "unknown-parent";

export interface PluginRouteErrorDetails {
  code: PluginRouteErrorCode;
  /** The route that already owned the id or the path, on a collision. */
  conflictsWith?: { pluginId: string; routeId: string };
  path?: string;
  pluginId: string;
  routeId?: string;
}

export class PluginRouteError extends Error {
  constructor(message: string, details: PluginRouteErrorDetails) {
    super(message);

    this.name = "PluginRouteError";
    this.code = details.code;
    this.conflictsWith = details.conflictsWith;
    this.path = details.path;
    this.pluginId = details.pluginId;
    this.routeId = details.routeId;
  }

  readonly code: PluginRouteErrorCode;
  readonly conflictsWith?: { pluginId: string; routeId: string };
  readonly path?: string;
  readonly pluginId: string;
  readonly routeId?: string;
}
