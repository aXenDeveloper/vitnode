import type { ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";

import type { BaseBuildModuleReturn } from "../module";
import type { Route } from "../route";
import type { RouteStaffPermissions } from "../route-metadata";
import type { McpJsonSchema } from "./schema";

import {
  isAdminApiPath,
  routeMcp,
  routeStaffPermissions,
} from "../route-metadata";
import {
  isScalarJsonSchema,
  McpSchemaError,
  nestJsonSchemas,
  propertiesOf,
  requestJsonSchema,
  requiredOf,
  responseJsonSchema,
} from "./schema";

/** Tool names stay inside what every MCP client accepts: no dots, no slashes. */
const TOOL_NAME_PART = /^[A-Za-z0-9_-]+$/;
/** The MCP specification's limit on a tool name. */
export const MCP_TOOL_NAME_MAX_LENGTH = 128;
/** Between the plugin half and the operation half of a tool name. */
export const MCP_TOOL_NAME_SEPARATOR = "__";

/** Where one argument group of a tool goes in the HTTP request. */
export interface McpArgumentGroup {
  /** Every key the group's schema declares. */
  names: readonly string[];
  required: boolean;
}

/**
 * One route as an MCP tool: what `tools/list` advertises, plus what the
 * dispatcher needs to turn a call back into the route's own request. Static -
 * who may see or call it is decided per request.
 */
export interface McpToolDescriptor {
  annotations?: ToolAnnotations;
  description: string;
  /** Request groups the route declares; absent groups are never sent. */
  groups: {
    body?: McpArgumentGroup;
    params?: McpArgumentGroup;
    query?: McpArgumentGroup;
  };
  inputSchema: McpJsonSchema;
  /** Uppercase HTTP method. */
  method: string;
  /** The tool's full name, `{plugin prefix}__{operation}`. */
  name: string;
  /** The operation half of the name. */
  operation: string;
  /** Only when exactly one success response declares a describable JSON body. */
  outputSchema?: McpJsonSchema;
  /** The route's path inside its plugin, with `{param}` placeholders: `/admin/content/posts/{id}`. */
  path: string;
  pluginId: string;
  /** Under an `admin` path segment, so it needs an admin. */
  requiresAdmin: boolean;
  staffPermissions?: RouteStaffPermissions;
}

/**
 * The plugin half of a tool name: the package name without `@`, every other
 * character outside `[A-Za-z0-9_-]` turned into `-`. `@vitnode/blog` becomes
 * `vitnode-blog`. Two installed plugins mapping to one prefix stop the API
 * from starting.
 */
export const mcpPluginPrefix = (pluginId: string): string =>
  pluginId.replace(/^@/, "").replace(/[^A-Za-z0-9_-]+/g, "-");

const byName = (left: McpToolDescriptor, right: McpToolDescriptor): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

/** `get_admin_notes_by_id` for `GET /admin/notes/{id}`. */
export const derivedMcpOperation = (method: string, path: string): string =>
  [
    method.toLowerCase(),
    ...path
      .split("/")
      .filter(Boolean)
      .map(segment => {
        const param = /^\{(.+)\}$/.exec(segment);

        return param ? `by_${param[1]}` : segment;
      }),
  ]
    .join("_")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "");

const joinPath = (prefix: string, path: string): string =>
  path === "/" || path === "" ? prefix || "/" : `${prefix}${path}`;

interface RouteRequestConfig {
  body?: {
    content?: Record<string, undefined | { schema?: unknown }>;
    required?: boolean;
  };
  cookies?: unknown;
  headers?: unknown;
  params?: unknown;
  query?: unknown;
}

interface RouteResponseConfig {
  content?: Record<string, undefined | { schema?: unknown }>;
}

const isZodSchema = (value: unknown): value is z.ZodType =>
  typeof value === "object" && value !== null && "_zod" in value;

const describeRouteTool = (
  route: Route,
  { path, pluginId }: { path: string; pluginId: string },
): McpToolDescriptor | undefined => {
  const options = routeMcp(route);
  if (!options) return undefined;

  const config = route.route as typeof route.route & {
    description?: string;
    operationId?: string;
    summary?: string;
    withCaptcha?: boolean;
  };
  const method = config.method.toUpperCase();
  const where = `MCP tool for ${method} ${path} in "${pluginId}"`;
  const fail = (reason: string): never => {
    throw new McpSchemaError(`${where}: ${reason}`);
  };

  const operation =
    options.name ?? config.operationId ?? derivedMcpOperation(method, path);
  if (!TOOL_NAME_PART.test(operation)) {
    fail(
      `the name "${operation}" may only use letters, digits, "_" and "-". Set \`mcp.name\`.`,
    );
  }
  const name = `${mcpPluginPrefix(pluginId)}${MCP_TOOL_NAME_SEPARATOR}${operation}`;
  if (name.length > MCP_TOOL_NAME_MAX_LENGTH) {
    fail(
      `the name "${name}" is longer than ${MCP_TOOL_NAME_MAX_LENGTH} characters. Set a shorter \`mcp.name\`.`,
    );
  }

  const description = (
    options.description ??
    config.description ??
    config.summary ??
    ""
  ).trim();
  if (!description) {
    fail(
      "it has no description. Add `summary` or `description` to the route, or `mcp.description`.",
    );
  }

  if (config.withCaptcha) {
    fail(
      "the route requires a captcha, which an MCP client cannot solve. Leave it off MCP.",
    );
  }

  const request = (config.request ?? {}) as RouteRequestConfig;
  if (request.headers || request.cookies) {
    fail(
      "it declares request headers or cookies. An MCP tool only sends path parameters, a query and a JSON body.",
    );
  }

  const children: Record<string, McpJsonSchema> = {};
  const groups: McpToolDescriptor["groups"] = {};
  const required: string[] = [];

  const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map(
    match => match[1],
  );
  if (request.params) {
    if (!isZodSchema(request.params)) fail("its params are not a Zod schema.");
    const schema = requestJsonSchema(
      request.params as z.ZodType,
      `${where}, params`,
    );
    const properties = propertiesOf(schema);
    for (const [key, property] of Object.entries(properties)) {
      if (!isScalarJsonSchema(property)) {
        fail(`the path parameter "${key}" is not a string, number or boolean.`);
      }
    }
    const missing = placeholders.filter(name => !(name in properties));
    if (missing.length > 0) {
      fail(`the path parameters ${missing.join(", ")} have no schema.`);
    }
    children.params = {
      ...schema,
      required: [...new Set([...requiredOf(schema), ...placeholders])],
    };
    groups.params = { names: Object.keys(properties), required: true };
    required.push("params");
  } else if (placeholders.length > 0) {
    fail(`the path parameters ${placeholders.join(", ")} have no schema.`);
  }

  if (request.query) {
    if (!isZodSchema(request.query)) fail("its query is not a Zod schema.");
    const schema = requestJsonSchema(
      request.query as z.ZodType,
      `${where}, query`,
    );
    const properties = propertiesOf(schema);
    for (const [key, property] of Object.entries(properties)) {
      if (!isScalarJsonSchema(property)) {
        fail(
          `the query parameter "${key}" is not a single string, number or boolean. Arrays and objects have no agreed URL form, so such a route cannot be a tool.`,
        );
      }
    }
    children.query = schema;
    const queryRequired = requiredOf(schema).length > 0;
    groups.query = { names: Object.keys(properties), required: queryRequired };
    if (queryRequired) required.push("query");
  }

  if (request.body) {
    const content = request.body.content ?? {};
    const types = Object.keys(content);
    const json = content["application/json"]?.schema;
    if (types.length !== 1 || !isZodSchema(json)) {
      fail(
        `its body is ${types.join(", ") || "undeclared"}. Only a single application/json body is supported.`,
      );
    }
    const schema = requestJsonSchema(json as z.ZodType, `${where}, body`);
    children.body = schema;
    // Required when the route says so, or when the body itself cannot be
    // valid without keys - which is what a caller has to know.
    const bodyRequired =
      request.body.required === true || requiredOf(schema).length > 0;
    groups.body = {
      names: Object.keys(propertiesOf(schema)),
      required: bodyRequired,
    };
    if (bodyRequired) required.push("body");
  }

  const nested = nestJsonSchemas(children, where);
  const inputSchema: McpJsonSchema = {
    type: "object",
    ...nested,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };

  const success = Object.entries(
    (config.responses ?? {}) as Record<string, RouteResponseConfig>,
  ).filter(([status]) => /^2\d\d$/.test(status));
  for (const [status, response] of success) {
    const types = Object.keys(response.content ?? {});
    if (types.some(type => type !== "application/json")) {
      fail(
        `its ${status} response is ${types.join(", ")}. Tools return JSON only - streams, files and HTML are not supported.`,
      );
    }
  }

  let outputSchema: McpJsonSchema | undefined;
  const [onlySuccess] = success;
  const onlySchema =
    success.length === 1
      ? onlySuccess[1].content?.["application/json"]
      : undefined;
  if (isZodSchema(onlySchema?.schema)) {
    const json = responseJsonSchema(onlySchema.schema);
    if (json) {
      outputSchema =
        json.type === "object"
          ? json
          : {
              type: "object",
              ...nestJsonSchemas({ result: json }, where),
              required: ["result"],
            };
    }
  }

  const annotations: ToolAnnotations | undefined = options.annotations
    ? { ...options.annotations }
    : undefined;

  return {
    annotations,
    description,
    groups,
    inputSchema,
    method,
    name,
    operation,
    outputSchema,
    path,
    pluginId,
    requiresAdmin: isAdminApiPath(path),
    staffPermissions: routeStaffPermissions(route),
  };
};

const walk = (
  module: BaseBuildModuleReturn,
  prefix: string,
  pluginId: string,
  into: McpToolDescriptor[],
): void => {
  const modulePath = `${prefix}/${module.name}`;
  for (const route of module.routes) {
    const tool = describeRouteTool(route, {
      path: joinPath(modulePath, route.route.path),
      pluginId,
    });
    if (tool) into.push(tool);
  }
  for (const child of module.modules ?? []) {
    walk(child, modulePath, pluginId, into);
  }
};

const assertUniqueNames = (tools: readonly McpToolDescriptor[]): void => {
  const seen = new Map<string, McpToolDescriptor>();
  for (const tool of tools) {
    const first = seen.get(tool.name);
    if (first) {
      throw new McpSchemaError(
        `Two routes expose the MCP tool "${tool.name}": ${first.method} ${first.path} in "${first.pluginId}" and ${tool.method} ${tool.path} in "${tool.pluginId}". Give one of them its own \`mcp.name\` or \`operationId\`.`,
      );
    }
    seen.set(tool.name, tool);
  }
};

/**
 * Every route of one plugin marked with `mcp`, at any depth of its module
 * tree, as tool descriptors sorted by name. Called by `buildApiPlugin`, so a
 * tool that cannot work fails at boot whether or not MCP is turned on.
 *
 * @throws When a marked route has no description, an invalid or too long
 * name, a captcha, headers or cookies, a non-JSON body or success response, a
 * schema with no JSON form - or when two routes share a tool name.
 */
export const collectPluginMcpTools = ({
  modules,
  pluginId,
}: {
  modules: readonly BaseBuildModuleReturn[];
  pluginId: string;
}): McpToolDescriptor[] => {
  const tools: McpToolDescriptor[] = [];
  for (const module of modules) walk(module, "", pluginId, tools);
  assertUniqueNames(tools);

  return tools.sort(byName);
};

/** The install's tools, built once per API instance. */
export interface McpRegistry {
  byName: ReadonlyMap<string, McpToolDescriptor>;
  /** Plugins that expose at least one tool. */
  pluginIds: readonly string[];
  /** Sorted by name - the order `tools/list` pages through. */
  tools: readonly McpToolDescriptor[];
}

/**
 * Joins every plugin's tools into one registry, the single source both the
 * install-wide endpoint and the per-plugin endpoints read.
 *
 * @throws When two plugins share a tool-name prefix (`@acme/blog` and
 * `acme-blog`), or two tools share a name.
 */
export const buildMcpRegistry = (
  plugins: readonly {
    mcpTools?: readonly McpToolDescriptor[];
    pluginId: string;
  }[],
): McpRegistry => {
  const prefixes = new Map<string, string>();
  for (const { pluginId } of plugins) {
    const prefix = mcpPluginPrefix(pluginId);
    const other = prefixes.get(prefix);
    if (other !== undefined && other !== pluginId) {
      throw new McpSchemaError(
        `The plugins "${other}" and "${pluginId}" both name their MCP tools "${prefix}${MCP_TOOL_NAME_SEPARATOR}...". Install only one of them with MCP turned on.`,
      );
    }
    prefixes.set(prefix, pluginId);
  }

  const tools = plugins.flatMap(plugin => plugin.mcpTools ?? []).sort(byName);
  assertUniqueNames(tools);

  return {
    byName: new Map(tools.map(tool => [tool.name, tool])),
    pluginIds: [...new Set(tools.map(tool => tool.pluginId))].sort(),
    tools,
  };
};
