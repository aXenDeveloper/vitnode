import { z } from "zod";

import type { BuildPluginApiReturn } from "../plugin";
import type { ResolvedMcpConfig } from "./config";
import type { McpRouteTool } from "./route-tools";
import type { McpScope } from "./scopes";
import type { AnyMcpToolDefinition } from "./tool";

import { CONFIG } from "../config";
import { MCP_WIRE_TOOL_NAME, mcpWireToolName } from "./naming";

/** A JSON Schema with an object at its root, as MCP's `inputSchema` and `outputSchema` require. */
export interface McpJsonSchemaObject {
  $schema?: string;
  [key: string]: unknown;
  properties?: Record<string, object>;
  required?: string[];
  type: "object";
}

/** MCP `ToolAnnotations`: hints, never guarantees, for clients. */
export interface McpToolAnnotations {
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint: boolean;
  readOnlyHint: boolean;
  title?: string;
}

interface McpRegisteredToolBase {
  readonly annotations: McpToolAnnotations;
  readonly description: string;
  readonly inputSchema: McpJsonSchemaObject;
  /** `"<pluginId>:<localName>"`, as `mcp.disabledTools` names it. */
  readonly key: string;
  /** The name inside the plugin (`forum.stats.forums.get`). */
  readonly localName: string;
  /** The wire name clients call it by (`forum_forum_stats_forums_get`). */
  readonly name: string;
  /** Only when the result is also sent as `structuredContent`. */
  readonly outputSchema: McpJsonSchemaObject | undefined;
  readonly pluginId: string;
  /** The scope a token needs to call it. */
  readonly scope: McpScope;
  readonly title: string | undefined;
}

/** One tool the MCP endpoint offers. */
export type McpRegisteredTool = McpRegisteredToolBase &
  (
    | { readonly definition: AnyMcpToolDefinition; readonly kind: "custom" }
    | { readonly kind: "route"; readonly route: McpRouteTool }
  );

/** Every tool the MCP endpoint offers, built once at startup. */
export interface McpToolRegistry {
  /** By wire name. */
  readonly byName: ReadonlyMap<string, McpRegisteredTool>;
  /** In plugin order, core first. */
  readonly tools: readonly McpRegisteredTool[];
}

const asSchemaObject = (schema: unknown): McpJsonSchemaObject => {
  if (
    typeof schema !== "object" ||
    schema === null ||
    (schema as { type?: unknown }).type !== "object"
  ) {
    throw new Error("Expected a JSON Schema object.");
  }

  return schema as McpJsonSchemaObject;
};

/** Arguments: always representable - anything JSON Schema cannot say is left open. */
const inputJsonSchema = (schema: z.ZodObject): McpJsonSchemaObject =>
  asSchemaObject(
    z.toJSONSchema(schema, {
      io: "input",
      target: "draft-2020-12",
      unrepresentable: "any",
    }),
  );

/**
 * A route's success response. Read in input mode, which leaves extra properties
 * allowed: the route's JSON is sent as is, and a route may say more than its
 * schema lists. `undefined` when the schema holds something JSON cannot carry
 * (a `Date`), so the tool then answers with text only.
 */
const routeOutputJsonSchema = (
  schema: undefined | z.ZodObject,
): McpJsonSchemaObject | undefined => {
  if (!schema) return undefined;
  try {
    return asSchemaObject(
      z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" }),
    );
  } catch {
    return undefined;
  }
};

const routeInputSchema = ({ input }: McpRouteTool): z.ZodObject =>
  z.object({
    ...input.params?.shape,
    ...input.query?.shape,
    ...input.body?.shape,
  });

const routeAnnotations = (
  { method }: McpRouteTool,
  title: string | undefined,
): McpToolAnnotations => {
  const readOnly = method === "GET" || method === "HEAD";

  return {
    ...(title ? { title } : {}),
    readOnlyHint: readOnly,
    ...(readOnly
      ? {}
      : {
          destructiveHint: method === "DELETE",
          idempotentHint: method === "PUT" || method === "DELETE",
        }),
    openWorldHint: false,
  };
};

const routeEntry = (
  pluginId: string,
  route: McpRouteTool,
): McpRegisteredTool => ({
  annotations: routeAnnotations(route, route.title),
  description: route.description,
  inputSchema: inputJsonSchema(routeInputSchema(route)),
  key: `${pluginId}:${route.name}`,
  kind: "route",
  localName: route.name,
  name: mcpWireToolName(pluginId, route.name),
  outputSchema: routeOutputJsonSchema(route.outputSchema),
  pluginId,
  route,
  scope: route.method === "GET" || route.method === "HEAD" ? "read" : "write",
  title: route.title,
});

const customEntry = (
  pluginId: string,
  definition: AnyMcpToolDefinition,
): McpRegisteredTool => {
  const key = `${pluginId}:${definition.id}`;
  let outputSchema: McpJsonSchemaObject | undefined;
  if (definition.outputSchema) {
    try {
      // Output mode: the handler's value is parsed, so what is sent is
      // exactly the schema's output.
      outputSchema = asSchemaObject(
        z.toJSONSchema(definition.outputSchema, {
          io: "output",
          target: "draft-2020-12",
        }),
      );
    } catch {
      throw new Error(
        `The MCP tool "${key}" has an outputSchema JSON Schema cannot describe (a Date, a Map, a transform...). Return JSON values - strings for dates.`,
      );
    }
  }
  const readOnly = definition.scope === "read";

  return {
    annotations: {
      ...(definition.title ? { title: definition.title } : {}),
      readOnlyHint: readOnly,
      ...(readOnly
        ? {}
        : {
            destructiveHint: definition.destructive ?? false,
            idempotentHint: definition.idempotent ?? false,
          }),
      openWorldHint: definition.openWorld ?? false,
    },
    definition,
    description: definition.description.trim(),
    inputSchema: inputJsonSchema(definition.inputSchema),
    key,
    kind: "custom",
    localName: definition.id,
    name: mcpWireToolName(pluginId, definition.id),
    outputSchema,
    pluginId,
    scope: definition.scope,
    title: definition.title,
  };
};

/**
 * Collects the tools of every plugin into the registry the MCP endpoint
 * serves, leaving out plugins not in `config.plugins` and tools in
 * `config.disabledTools`. In development, warns about configured plugin ids or
 * tool keys that match nothing. Server-only; call it once at startup.
 *
 * @throws When two offered tools share a wire name, or one is longer than 64
 * characters - rename the route's tool with `mcp: { name }`.
 */
export const buildMcpToolRegistry = ({
  config,
  plugins,
}: {
  config: Pick<ResolvedMcpConfig, "disabledTools" | "plugins">;
  plugins: readonly Pick<
    BuildPluginApiReturn,
    "mcpRouteTools" | "mcpTools" | "pluginId"
  >[];
}): McpToolRegistry => {
  const all = plugins.flatMap(plugin => [
    ...(plugin.mcpRouteTools ?? []).map(route =>
      routeEntry(plugin.pluginId, route),
    ),
    ...(plugin.mcpTools ?? []).map(definition =>
      customEntry(plugin.pluginId, definition),
    ),
  ]);

  if (CONFIG.node_development) {
    const installed = new Set(plugins.map(plugin => plugin.pluginId));
    const keys = new Set(all.map(tool => tool.key));
    const unknown = [
      ...[...(config.plugins ?? [])]
        .filter(id => !installed.has(id))
        .map(id => `plugin "${id}"`),
      ...[...config.disabledTools]
        .filter(key => !keys.has(key))
        .map(key => `tool "${key}"`),
    ];
    if (unknown.length > 0) {
      // oxlint-disable-next-line no-console
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mThe \`mcp\` config names what is not installed:\x1b[0m ${unknown.join(", ")}.`,
      );
    }
  }

  const tools = all.filter(
    tool =>
      (config.plugins === null || config.plugins.has(tool.pluginId)) &&
      !config.disabledTools.has(tool.key),
  );

  const byName = new Map<string, McpRegisteredTool>();
  for (const tool of tools) {
    if (!MCP_WIRE_TOOL_NAME.test(tool.name)) {
      throw new Error(
        `The MCP tool "${tool.key}" is listed to clients as "${tool.name}" (${tool.name.length} characters), and MCP allows at most 64 letters, digits, "_" and "-". Give it a shorter name with \`mcp: { name }\` on its route or a shorter custom tool id.`,
      );
    }
    const taken = byName.get(tool.name);
    if (taken) {
      throw new Error(
        `The MCP tools "${taken.key}" and "${tool.key}" are both listed to clients as "${tool.name}". Rename one with \`mcp: { name }\` on its route, or disable one with \`mcp.disabledTools\`.`,
      );
    }
    byName.set(tool.name, tool);
  }

  return { byName, tools };
};
