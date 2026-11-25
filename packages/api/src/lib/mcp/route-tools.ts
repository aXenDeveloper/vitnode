import { z } from "zod";

import type { Route } from "../route";
import type { AnyMcpToolDefinition } from "./tool";

import { isAdminApiPath, routeStaffPermissions } from "../route-metadata";
import { MCP_LOCAL_TOOL_NAME, mcpRouteToolName } from "./naming";
import { MCP_SCOPES } from "./scopes";

/** A route offered as an MCP tool, named and validated by `buildApiPlugin`. */
export interface McpRouteTool {
  /** For the AI model: `mcp.description`, else the route's `description`. */
  readonly description: string;
  /** The route's request parts the tool's arguments are split into. */
  readonly input: {
    readonly body: undefined | z.ZodObject;
    readonly params: undefined | z.ZodObject;
    readonly query: undefined | z.ZodObject;
  };
  /** Uppercase, as the route is mounted. */
  readonly method: string;
  /** The module path below the plugin, `admin/ai` for an `ai` module in `admin`. */
  readonly modulePath: string;
  /** The tool's name inside the plugin. */
  readonly name: string;
  /** The success response's JSON schema, when it is an object. */
  readonly outputSchema: undefined | z.ZodObject;
  /** Relative to the module, with OpenAPI-style params (`/{id}`). */
  readonly path: string;
  /** The route's `summary`, when it has one. */
  readonly title: string | undefined;
}

/** A module, as much of one as collecting route tools reads. */
interface McpModuleNode {
  readonly modules?: readonly McpModuleNode[];
  readonly name: string;
  readonly routes: readonly Route[];
}

const isZodObject = (value: unknown): value is z.ZodObject =>
  value instanceof z.ZodObject;

const objectPart = (
  value: unknown,
  fail: (problem: string) => never,
  part: string,
): undefined | z.ZodObject => {
  if (value === undefined) return undefined;
  if (!isZodObject(value)) fail(`its ${part} schema is not a zod object`);

  return value;
};

const bodyPart = (
  body: unknown,
  fail: (problem: string) => never,
): undefined | z.ZodObject => {
  if (body === undefined) return undefined;
  const content =
    typeof body === "object" && body !== null && "content" in body
      ? (body.content as Record<string, unknown> | undefined)
      : undefined;
  const types = Object.keys(content ?? {});
  if (types.length !== 1 || types[0] !== "application/json") {
    fail(
      `its request body is ${types.length > 0 ? types.join(", ") : "empty"}, and a tool can only send application/json`,
    );
  }
  const media = content?.["application/json"];
  const schema =
    typeof media === "object" && media !== null && "schema" in media
      ? media.schema
      : undefined;
  if (!isZodObject(schema)) fail("its JSON body schema is not a zod object");

  return schema;
};

const successSchema = (responses: unknown): undefined | z.ZodObject => {
  if (typeof responses !== "object" || responses === null) return undefined;
  const status = Object.keys(responses)
    .filter(code => /^2\d\d$/.test(code))
    .sort()[0];
  if (!status) return undefined;
  const response: unknown = (responses as Record<string, unknown>)[status];
  if (typeof response !== "object" || response === null) return undefined;
  if (!("content" in response)) return undefined;
  const content = response.content as Record<string, unknown> | undefined;
  const media = content?.["application/json"];
  const schema =
    typeof media === "object" && media !== null && "schema" in media
      ? media.schema
      : undefined;

  return isZodObject(schema) ? schema : undefined;
};

const routeTool = (
  pluginId: string,
  modulePath: string,
  built: Route,
): McpRouteTool | undefined => {
  const { mcp, route } = built;
  if (!mcp) return undefined;

  const method = route.method.toUpperCase();
  const label = `${method} /${pluginId}/${modulePath}${route.path}`;
  const fail = (problem: string): never => {
    throw new Error(
      `Plugin "${pluginId}" offers ${label} as an MCP tool, but ${problem}.`,
    );
  };

  if (isAdminApiPath(`/${modulePath}${route.path}`)) {
    fail(
      "it is an admin route. MCP tokens never act as an admin - expose a member-facing route instead",
    );
  }
  const staff = routeStaffPermissions(built);
  if (staff?.admin) fail("it requires an admin staff permission");
  if (staff?.moderator) fail("it requires a moderator staff permission");
  if ((route as { withCaptcha?: boolean }).withCaptcha) {
    fail("it requires a captcha, which an AI client cannot solve");
  }

  const input = {
    params: objectPart(route.request?.params, fail, "params"),
    query: objectPart(route.request?.query, fail, "query"),
    body: bodyPart(route.request?.body, fail),
  };
  const seen = new Map<string, string>();
  for (const [part, schema] of Object.entries(input)) {
    for (const key of Object.keys(schema?.shape ?? {})) {
      const other = seen.get(key);
      if (other) {
        fail(
          `"${key}" is in both its ${other} and its ${part}, and a tool's arguments are one object`,
        );
      }
      seen.set(key, part);
    }
  }

  const options = mcp === true ? {} : mcp;
  const name =
    options.name ?? mcpRouteToolName({ method, modulePath, path: route.path });
  if (!MCP_LOCAL_TOOL_NAME.test(name)) {
    fail(
      `its tool name "${name}" is invalid - use lowercase letters and digits joined by ".", "_" or "-", and set \`mcp: { name }\` when the derived one is not`,
    );
  }

  const description = (options.description ?? route.description ?? "").trim();
  if (!description) {
    fail(
      "it has no description. Set the route's `description` or `mcp: { description }` - it is what the AI model reads to pick the tool",
    );
  }

  const title = route.summary?.trim();

  return {
    description,
    input,
    method,
    modulePath,
    name,
    outputSchema: successSchema(route.responses),
    path: route.path,
    title: title === "" ? undefined : title,
  };
};

const collectModule = (
  pluginId: string,
  prefix: string,
  module: McpModuleNode,
): McpRouteTool[] => {
  const modulePath = `${prefix}${module.name}`;

  return [
    ...module.routes.flatMap(route => {
      const tool = routeTool(pluginId, modulePath, route);

      return tool ? [tool] : [];
    }),
    ...(module.modules ?? []).flatMap(child =>
      collectModule(pluginId, `${modulePath}/`, child),
    ),
  ];
};

const checkCustomTool = (
  pluginId: string,
  tool: AnyMcpToolDefinition,
): void => {
  const fail = (problem: string): never => {
    throw new Error(
      `Plugin "${pluginId}" registers the MCP tool "${tool.id}", but ${problem}.`,
    );
  };

  if (!MCP_LOCAL_TOOL_NAME.test(tool.id)) {
    fail(
      'its id is invalid - use lowercase letters and digits joined by ".", "_" or "-"',
    );
  }
  if (!tool.description.trim()) fail("it has no description");
  if (!(MCP_SCOPES as readonly string[]).includes(tool.scope)) {
    fail(`its scope "${tool.scope}" is not "read" or "write"`);
  }
  if (!isZodObject(tool.inputSchema))
    fail("its inputSchema is not a zod object");
  if (tool.outputSchema !== undefined && !isZodObject(tool.outputSchema)) {
    fail("its outputSchema is not a zod object");
  }
  if (typeof tool.handler !== "function") fail("it has no handler");
};

/**
 * Names and validates a plugin's MCP tools: every route built with `mcp`,
 * anywhere in the module tree, and the custom tools passed to
 * `buildApiPlugin`. Returns the route tools.
 *
 * @throws When a tool breaks a rule `BuildRouteOptions.mcp` lists, a custom
 * tool is malformed, or two tools of the plugin share a name.
 */
export const collectMcpPluginTools = ({
  customTools,
  modules,
  pluginId,
}: {
  customTools: readonly AnyMcpToolDefinition[];
  modules: readonly McpModuleNode[];
  pluginId: string;
}): McpRouteTool[] => {
  const routeTools = modules.flatMap(module =>
    collectModule(pluginId, "", module),
  );
  customTools.forEach(tool => {
    checkCustomTool(pluginId, tool);
  });

  const names = new Set<string>();
  for (const name of [
    ...routeTools.map(tool => tool.name),
    ...customTools.map(tool => tool.id),
  ]) {
    if (names.has(name)) {
      throw new Error(
        `Plugin "${pluginId}" has two MCP tools named "${name}". Rename one with \`mcp: { name }\` on the route or a different custom tool \`id\`.`,
      );
    }
    names.add(name);
  }

  return routeTools;
};
