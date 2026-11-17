import type { ToolAnnotations } from "@modelcontextprotocol/server";

/**
 * Hints an MCP client shows or uses to decide how carefully to treat a tool -
 * whether to ask before calling it, say. They are hints only: they never grant
 * access, skip an approval or change what the route enforces. Nothing is
 * inferred from the HTTP method, so a route without annotations tells the
 * client nothing.
 */
export type RouteMcpAnnotations = Pick<
  ToolAnnotations,
  | "destructiveHint"
  | "idempotentHint"
  | "openWorldHint"
  | "readOnlyHint"
  | "title"
>;

/**
 * How a route is described as an MCP tool. Every field is optional; `mcp: true`
 * is the same as `mcp: {}`.
 */
export interface RouteMcpOptions {
  /** Client hints, see {@link RouteMcpAnnotations}. */
  annotations?: RouteMcpAnnotations;
  /**
   * What the tool does, for the model choosing it. Defaults to the route's
   * `description`, then its `summary`. A tool needs one of the three: the API
   * refuses to start without it.
   */
  description?: string;
  /**
   * The operation half of the tool name, `[A-Za-z0-9_-]`. Defaults to the
   * route's `operationId`, then to a name derived from the method and the
   * route's full path inside the plugin (`get_admin_notes_by_id`). The plugin
   * half is always added in front, so two plugins never share a name.
   */
  name?: string;
}

/** What a route definition's `mcp` accepts. Omitted or `false` keeps the route off MCP. */
export type RouteMcpConfig = boolean | RouteMcpOptions;
