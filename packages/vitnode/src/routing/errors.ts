export type PluginRouteErrorCode =
  | "childless-layout"
  | "conflicting-requires"
  | "cross-area-parent"
  | "cross-plugin-parent"
  | "duplicate-id"
  | "duplicate-path"
  | "invalid-area"
  | "invalid-entry"
  | "invalid-id"
  | "invalid-kind"
  | "invalid-namespace"
  | "invalid-parent"
  | "invalid-parent-kind"
  | "invalid-parent-path"
  | "invalid-path"
  | "invalid-plugin-id"
  | "invalid-requires"
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

/**
 * A plugin route that cannot be part of a manifest.
 *
 * Thrown rather than collected, and thrown on the first problem: a manifest with
 * two plugins claiming `/blog` has no correct interpretation, and picking one is
 * how an install silently serves the wrong page for a release. The structured
 * fields are here so a build tool can render the failure its own way without
 * parsing the message.
 */
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
