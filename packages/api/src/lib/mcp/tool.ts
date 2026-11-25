import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { McpPrincipal } from "./principal";
import type { McpScope } from "./scopes";

/** What a custom tool's `handler` receives. */
export interface McpToolHandlerArgs<Input> {
  /**
   * The `/mcp` request's context. `c.get("user")` is the member who connected
   * the client (`null` for a guest), never the session cookie's, and
   * `c.get("mcp")` says the request is an MCP call. `db`, `cache`, `events`
   * and the other models work as they do in a route.
   */
  c: Context<EnvVitNode>;
  /** The arguments, already parsed by `inputSchema`. */
  input: Input;
  /** The member's connection, or `null` for a guest (`mcp.guestAccess`). */
  principal: McpPrincipal | null;
}

/**
 * What a handler returns: an object matching `outputSchema` when there is one
 * (sent as `structuredContent` and as JSON text), else any JSON-serializable
 * value (sent as JSON text; a string is sent as is).
 */
export type McpToolOutput<Output extends undefined | z.ZodObject> =
  Output extends z.ZodObject ? z.input<Output> : unknown;

/** A custom MCP tool, from {@link defineMcpTool}. */
export interface McpToolDefinition<
  Id extends string = string,
  Input extends z.ZodObject = z.ZodObject,
  Output extends undefined | z.ZodObject = undefined | z.ZodObject,
> {
  /** What the tool does, for the AI model, in plain English. Required. */
  readonly description: string;
  /**
   * Whether the tool may delete or overwrite data, as a hint to clients
   * (`destructiveHint`). Only meaningful for `write` tools. Defaults to `false`.
   */
  readonly destructive?: boolean;
  /**
   * Runs the tool. Throw an `HTTPException` (or any error) to fail the call:
   * the client gets `isError: true` with the exception's status and message;
   * any other error is reported without its details outside development.
   */
  readonly handler: (
    args: McpToolHandlerArgs<z.output<Input>>,
  ) => McpToolOutput<Output> | Promise<McpToolOutput<Output>>;
  /**
   * The tool's name inside the plugin: lowercase letters and digits in groups
   * joined by `.`, `_` or `-` (`topics.summarize`). Clients see it prefixed
   * with the plugin (`forum_topics_summarize`); `mcp.disabledTools` names it
   * `"<pluginId>:<id>"`.
   */
  readonly id: Id;
  /**
   * Whether calling it again with the same arguments changes nothing more, as a
   * hint to clients (`idempotentHint`). Defaults to `false`.
   */
  readonly idempotent?: boolean;
  /** The arguments, as a zod object. Invalid arguments are refused before the handler runs. */
  readonly inputSchema: Input;
  /**
   * Whether the tool reaches outside this site (another service, the web), as
   * a hint to clients (`openWorldHint`). Defaults to `false`.
   */
  readonly openWorld?: boolean;
  /**
   * The result's shape, as a zod object. With it, the handler's return value
   * is validated and sent as `structuredContent` too.
   */
  readonly outputSchema?: Output;
  /**
   * The scope a token needs to call it: `read` for a tool that changes
   * nothing (guests may call those with `mcp.guestAccess`), `write` otherwise.
   */
  readonly scope: McpScope;
  /** A short human-readable name for client UIs, e.g. `"Summarize a topic"`. */
  readonly title?: string;
}

/** Any {@link McpToolDefinition}, as `buildApiPlugin`'s `mcpTools` holds them. */
export type AnyMcpToolDefinition = McpToolDefinition;

/**
 * Declares a custom MCP tool: code that runs for an AI client when a route
 * tool (`buildRoute({ mcp: true })`) is not the right fit. Register it with
 * `buildApiPlugin({ mcpTools: [...] })`; it is offered on `/api/mcp` once the
 * app sets `mcp.enabled`.
 *
 * Every string is plain English sent to the AI model - not an i18n key.
 * The handler runs as the connected member (or a guest), with the member's
 * own permissions: check them as a route would. Server-only.
 *
 * @example
 * ```ts
 * import { defineMcpTool } from "@vitnode/api/lib/mcp/tool";
 * import { z } from "zod";
 *
 * export const countTopicsTool = defineMcpTool({
 *   id: "topics.count",
 *   title: "Count topics",
 *   description: "Counts the public topics of one forum.",
 *   scope: "read",
 *   inputSchema: z.object({ forumId: z.number().int().positive() }),
 *   outputSchema: z.object({ count: z.number().int() }),
 *   handler: async ({ c, input }) => ({
 *     count: await countPublicTopics(c, input.forumId),
 *   }),
 * });
 * ```
 */
export const defineMcpTool = <
  const Id extends string,
  Input extends z.ZodObject,
  Output extends undefined | z.ZodObject = undefined,
>(
  definition: McpToolDefinition<Id, Input, Output>,
): McpToolDefinition<Id, Input, Output> => definition;
