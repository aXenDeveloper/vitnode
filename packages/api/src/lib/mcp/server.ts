import type { Context, ExecutionContext } from "hono";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { ResolvedMcpConfig } from "./config";
import type { McpPrincipal } from "./principal";
import type { McpRegisteredTool, McpToolRegistry } from "./registry";

import { CONFIG } from "../config";
import { describeError } from "../error-details";
import { canBypassSiteOffline, loadSiteStatus } from "../site-status.server";
import {
  isMcpProtocolVersion,
  MCP_LATEST_PROTOCOL_VERSION,
  mcpAllowedOrigins,
} from "./http";
import { registerMcpOAuthRoutes } from "./oauth/routes";
import {
  authenticateMcpRequest,
  mcpUnauthorizedResponse,
} from "./oauth/verify";
import { markMcpInternalRequest } from "./principal";
import { formatMcpScopes, MCP_SCOPES } from "./scopes";
import { loadMcpUser } from "./user";

/** JSON-RPC 2.0 error codes the endpoint answers with. */
export const JSON_RPC_ERROR = {
  internalError: -32_603,
  invalidParams: -32_602,
  invalidRequest: -32_600,
  methodNotFound: -32_601,
  parseError: -32_700,
} as const;

type JsonRpcId = number | string;

interface JsonRpcRequest {
  id: JsonRpcId;
  method: string;
  params: unknown;
}

interface McpCallToolResult {
  [key: string]: unknown;
  content: { text: string; type: "text" }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/** A failed call, reported as a JSON-RPC error rather than a tool result. */
class McpProtocolError extends Error {
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
  readonly code: number;

  readonly data: unknown;
}

/** The root app a route tool's request is sent through. */
interface McpRootApp {
  fetch: (
    request: Request,
    env?: object,
    executionCtx?: ExecutionContext,
  ) => Promise<Response> | Response;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonRpcId = (value: unknown): value is JsonRpcId =>
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value));

const MAX_ERROR_BODY = 2_000;

const textResult = (
  text: string,
  structuredContent?: Record<string, unknown>,
): McpCallToolResult => ({
  content: [{ type: "text", text }],
  ...(structuredContent ? { structuredContent } : {}),
});

const toolError = (text: string): McpCallToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

const asJsonText = (value: unknown): string =>
  typeof value === "string" ? value : (JSON.stringify(value ?? null) ?? "null");

const executionCtxOf = (c: Context): ExecutionContext | undefined => {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
};

/** An argument as one URL value: strings as they are, anything else as JSON. */
const argumentText = (value: unknown): string =>
  typeof value === "string" ? value : (JSON.stringify(value) ?? "");

const queryValue = (value: unknown): string[] => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(queryValue);

  return [argumentText(value)];
};

const pick = (
  args: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(
    keys.filter(key => args[key] !== undefined).map(key => [key, args[key]]),
  );

const describeHttpStatus = (status: number): string =>
  `${status}${status >= 500 ? " (server error)" : ""}`;

/** Runs a route tool's route in process, as the caller. */
const runRouteTool = async ({
  apiBasePath,
  args,
  c,
  principal,
  rootApp,
  tool,
}: {
  apiBasePath: string;
  args: Record<string, unknown>;
  c: Context<EnvVitNode>;
  principal: McpPrincipal | null;
  rootApp: McpRootApp;
  tool: Extract<McpRegisteredTool, { kind: "route" }>;
}): Promise<McpCallToolResult> => {
  const { route } = tool;
  const missing: string[] = [];
  const path = route.path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = args[key];
    if (value === undefined || value === null || value === "") {
      missing.push(key);

      return "";
    }

    return encodeURIComponent(argumentText(value));
  });
  if (missing.length > 0) {
    throw new McpProtocolError(
      JSON_RPC_ERROR.invalidParams,
      `Missing required argument${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }

  const target = `${apiBasePath}/${tool.pluginId}/${route.modulePath}${path}`;
  const url = new URL(
    target.length > 1 ? target.replace(/\/$/, "") : target,
    new URL(c.req.url).origin,
  );
  for (const [key, value] of Object.entries(
    pick(args, Object.keys(route.input.query?.shape ?? {})),
  )) {
    for (const item of queryValue(value)) url.searchParams.append(key, item);
  }

  const headers = new Headers({ accept: "application/json" });
  const language = c.req.header("accept-language");
  if (language) headers.set("accept-language", language);
  const userAgent = c.req.header("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);

  let body: string | undefined;
  if (route.input.body) {
    body = JSON.stringify(pick(args, Object.keys(route.input.body.shape)));
    headers.set("content-type", "application/json");
    headers.set("content-length", `${new TextEncoder().encode(body).length}`);
  }

  const request = markMcpInternalRequest(
    new Request(url, { body, headers, method: route.method }),
    { ipAddress: c.get("ipAddress"), principal },
  );
  const response = await rootApp.fetch(request, c.env, executionCtxOf(c));
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = undefined;
  }

  if (!response.ok) {
    let detail = "";
    if (json === undefined) detail = text.slice(0, MAX_ERROR_BODY);
    else if (json !== null) detail = asJsonText(json);

    return toolError(
      `The request failed with HTTP ${describeHttpStatus(response.status)}${detail ? `: ${detail}` : "."}`,
    );
  }

  if (json === undefined) return textResult(text);

  if (tool.outputSchema && route.outputSchema) {
    const checked = route.outputSchema.safeParse(json);
    if (!checked.success || !isRecord(json)) {
      return toolError(
        "The tool's result did not match its declared output schema.",
      );
    }

    return textResult(asJsonText(json), json);
  }

  return textResult(asJsonText(json));
};

/** Runs a custom tool's handler on the `/mcp` request's own context. */
const runCustomTool = async ({
  args,
  c,
  principal,
  tool,
}: {
  args: Record<string, unknown>;
  c: Context<EnvVitNode>;
  principal: McpPrincipal | null;
  tool: Extract<McpRegisteredTool, { kind: "custom" }>;
}): Promise<McpCallToolResult> => {
  const { definition } = tool;
  const input = definition.inputSchema.safeParse(args);
  if (!input.success) {
    throw new McpProtocolError(
      JSON_RPC_ERROR.invalidParams,
      `Invalid arguments for tool ${tool.name}.`,
      input.error.issues.map(issue => ({
        message: issue.message,
        path: issue.path.map(String).join("."),
      })),
    );
  }

  // What `siteOfflineGuard` does for a route tool's route.
  const status = await loadSiteStatus(c).catch(() => null);
  if (status?.offline && !(await canBypassSiteOffline(c))) {
    return toolError("The site is offline for maintenance. Try again later.");
  }

  c.set("plugin", { id: tool.pluginId });
  const value: unknown = await definition.handler({
    c,
    input: input.data,
    principal,
  });

  if (!definition.outputSchema) return textResult(asJsonText(value));

  const output = definition.outputSchema.safeParse(value);
  if (!output.success) {
    await c
      .get("log")
      .error(
        `MCP tool "${tool.key}" returned a value that does not match its outputSchema: ${output.error.message}`,
      )
      .catch(() => undefined);

    return toolError(
      "The tool's result did not match its declared output schema.",
    );
  }

  return textResult(asJsonText(output.data), output.data);
};

const describeToolFailure = async (
  c: Context<EnvVitNode>,
  tool: McpRegisteredTool,
  error: unknown,
): Promise<McpCallToolResult> => {
  if (error instanceof HTTPException) {
    return toolError(
      `The tool failed with HTTP ${describeHttpStatus(error.status)}${error.message ? `: ${error.message}` : "."}`,
    );
  }

  const message = describeError(error);
  await c
    .get("log")
    .error(`MCP tool "${tool.key}" failed: ${message}`)
    .catch(() => undefined);

  return toolError(
    CONFIG.node_development
      ? `The tool failed: ${message}`
      : "The tool failed with an unexpected error.",
  );
};

const toolForWire = (tool: McpRegisteredTool) => ({
  name: tool.name,
  ...(tool.title ? { title: tool.title } : {}),
  description: tool.description,
  inputSchema: tool.inputSchema,
  ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
  annotations: tool.annotations,
});

/**
 * Builds the Hono sub-app `VitNodeAPI` mounts at `/mcp` below the API's base
 * path: the OAuth endpoints, and `POST /` speaking MCP's stateless Streamable
 * HTTP transport with JSON responses only (no SSE stream, no session).
 *
 * Each POST carries one JSON-RPC message: a request is answered with its
 * JSON-RPC response; a notification or a response gets `202`. `GET` and
 * `DELETE` are `405`. A bearer token authenticates the member; without one
 * the caller is a guest when `mcp.guestAccess` is on, else gets `401`. The
 * session cookie is never read.
 *
 * Route tools run their route in process through `rootApp.fetch`, so every
 * middleware and check of the route applies, as the token's member. Server-only.
 */
export const buildMcpApp = ({
  config,
  registry,
  rootApp,
  serverInfo,
}: {
  config: ResolvedMcpConfig;
  registry: McpToolRegistry;
  /** The app `VitNodeAPI` mounts everything on, base path included. */
  rootApp: McpRootApp;
  serverInfo: { name: string; title?: string; version: string };
}): Hono<EnvVitNode> => {
  const mcpApp = new Hono<EnvVitNode>();
  const allowedOrigins = mcpAllowedOrigins(config);

  const canCall = (
    tool: McpRegisteredTool,
    principal: McpPrincipal | null,
  ): boolean =>
    principal
      ? principal.scopes.includes(tool.scope)
      : config.guestAccess && tool.scope === "read";

  registerMcpOAuthRoutes(mcpApp);

  const methodNotAllowed = (c: Context) =>
    c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: JSON_RPC_ERROR.invalidRequest,
          message:
            "Method not allowed. This server is stateless: POST one JSON-RPC message per request.",
        },
      },
      405,
      { Allow: "POST" },
    );
  mcpApp.get("/", methodNotAllowed);
  mcpApp.delete("/", methodNotAllowed);

  mcpApp.post("/", async c => {
    const rpcError = (
      id: JsonRpcId | null,
      code: number,
      message: string,
      status: 200 | 400 | 403 = 200,
      data?: unknown,
    ) =>
      c.json(
        {
          jsonrpc: "2.0",
          id,
          error: { code, message, ...(data === undefined ? {} : { data }) },
        },
        status,
      );

    // DNS-rebinding protection: a browser page on another origin never gets
    // to drive the endpoint, even with a member's token.
    const origin = c.req.header("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return rpcError(
        null,
        JSON_RPC_ERROR.invalidRequest,
        "Origin not allowed.",
        403,
      );
    }

    const version = c.req.header("mcp-protocol-version");
    if (version !== undefined && !isMcpProtocolVersion(version)) {
      return rpcError(
        null,
        JSON_RPC_ERROR.invalidRequest,
        `Unsupported MCP-Protocol-Version "${version}".`,
        400,
      );
    }

    let principal: McpPrincipal | null = null;
    if (c.req.header("authorization") !== undefined) {
      const auth = await authenticateMcpRequest(c);
      if (!auth.ok) return auth.response;
      principal = auth.principal;
    } else if (!config.guestAccess) {
      return mcpUnauthorizedResponse(c);
    }

    const user = principal ? await loadMcpUser(c, principal.userId) : null;
    if (principal && !user) {
      return mcpUnauthorizedResponse(c, { error: "invalid_token" });
    }
    c.set("user", user);
    c.set("suspension", null);
    c.set("mcp", { principal });

    let message: unknown;
    try {
      message = JSON.parse(await c.req.text());
    } catch {
      return rpcError(null, JSON_RPC_ERROR.parseError, "Parse error.", 400);
    }

    if (Array.isArray(message)) {
      return rpcError(
        null,
        JSON_RPC_ERROR.invalidRequest,
        "Batches are not supported: send one JSON-RPC message per request.",
        400,
      );
    }
    if (!isRecord(message) || message.jsonrpc !== "2.0") {
      return rpcError(
        null,
        JSON_RPC_ERROR.invalidRequest,
        "Invalid JSON-RPC 2.0 message.",
        400,
      );
    }

    if (typeof message.method !== "string") {
      // A response to a request this server never sends, or junk.
      if (
        isJsonRpcId(message.id) &&
        ("result" in message || "error" in message)
      ) {
        return c.body(null, 202);
      }

      return rpcError(
        isJsonRpcId(message.id) ? message.id : null,
        JSON_RPC_ERROR.invalidRequest,
        "Invalid JSON-RPC 2.0 message.",
        400,
      );
    }
    if (!("id" in message)) {
      // Notifications (`notifications/initialized`, `.../cancelled`...) need no
      // answer, and a stateless server has nothing to update.
      return c.body(null, 202);
    }
    if (!isJsonRpcId(message.id)) {
      return rpcError(
        null,
        JSON_RPC_ERROR.invalidRequest,
        "Invalid JSON-RPC id.",
        400,
      );
    }

    const request: JsonRpcRequest = {
      id: message.id,
      method: message.method,
      params: message.params,
    };
    if (request.params !== undefined && !isRecord(request.params)) {
      return rpcError(
        request.id,
        JSON_RPC_ERROR.invalidParams,
        "params must be an object.",
      );
    }
    const params = request.params ?? {};
    const reply = (result: Record<string, unknown>) =>
      c.json({ jsonrpc: "2.0", id: request.id, result });

    switch (request.method) {
      case "initialize": {
        const requested = params.protocolVersion;

        return reply({
          protocolVersion:
            typeof requested === "string" && isMcpProtocolVersion(requested)
              ? requested
              : MCP_LATEST_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo,
          ...(config.instructions ? { instructions: config.instructions } : {}),
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({
          tools: registry.tools
            .filter(tool => canCall(tool, principal))
            .map(toolForWire),
        });
      case "tools/call": {
        const { arguments: args = {}, name } = params;
        if (typeof name !== "string") {
          return rpcError(
            request.id,
            JSON_RPC_ERROR.invalidParams,
            "params.name must be a string.",
          );
        }
        if (!isRecord(args)) {
          return rpcError(
            request.id,
            JSON_RPC_ERROR.invalidParams,
            "params.arguments must be an object.",
          );
        }
        const tool = registry.byName.get(name);
        if (!tool) {
          return rpcError(
            request.id,
            JSON_RPC_ERROR.invalidParams,
            `Unknown tool: ${name}`,
          );
        }
        // A tool the caller could not list: the `403` is what tells the client
        // to ask the member for a token with more scopes.
        if (!canCall(tool, principal)) {
          return mcpUnauthorizedResponse(c, {
            error: "insufficient_scope",
            scope: formatMcpScopes(MCP_SCOPES),
          });
        }

        try {
          const result =
            tool.kind === "route"
              ? await runRouteTool({
                  apiBasePath: config.apiBasePath,
                  args,
                  c,
                  principal,
                  rootApp,
                  tool,
                })
              : await runCustomTool({ args, c, principal, tool });

          return reply(result);
        } catch (error) {
          if (error instanceof McpProtocolError) {
            return rpcError(
              request.id,
              error.code,
              error.message,
              200,
              error.data,
            );
          }

          return reply(await describeToolFailure(c, tool, error));
        }
      }
      default:
        return rpcError(
          request.id,
          JSON_RPC_ERROR.methodNotFound,
          `Method not found: ${request.method}`,
        );
    }
  });

  return mcpApp;
};
