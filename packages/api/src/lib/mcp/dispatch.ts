import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Context, ExecutionContext, MiddlewareHandler } from "hono";

import type { McpToolDescriptor } from "./registry";

/** Who an MCP tool call acts as: the token's owner, through that token. */
export interface McpPrincipal {
  tokenId: number;
  userId: number;
}

/**
 * What the MCP endpoint hands to the one request it dispatches for a tool
 * call. Lives in a module-private map keyed by the `Request` object the
 * dispatcher itself constructs, so no header, cookie, argument or environment
 * value can produce one.
 */
export interface McpDispatchFrame {
  /** The MCP request's audit correlation id, so both share one. */
  correlationId: string;
  /** The MCP client's address, as the outer request resolved it. */
  ipAddress: string;
  principal: McpPrincipal;
  tool: string;
}

const pendingFrames = new WeakMap<Request, McpDispatchFrame>();
const activeFrames = new WeakMap<Context, McpDispatchFrame>();

/**
 * First middleware of the API: moves a dispatched request's frame from its
 * `Request` to its Hono context, which outlives the body-limit middleware
 * swapping `c.req.raw` for a wrapped copy.
 */
export const mcpDispatchMiddleware: MiddlewareHandler = async (c, next) => {
  const frame = pendingFrames.get(c.req.raw);
  if (frame) {
    pendingFrames.delete(c.req.raw);
    activeFrames.set(c, frame);
  }

  await next();
};

/**
 * The frame of a request the MCP endpoint dispatched, or `undefined` for every
 * other request. The global middleware reads the user from it instead of a
 * session cookie, the admin middleware the admin, the client-IP and rate-limit
 * middleware the caller.
 */
export const mcpDispatchOf = (c: Context): McpDispatchFrame | undefined =>
  activeFrames.get(c);

/** A tool call refused before it reached the route: bad arguments. */
export class McpArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpArgumentsError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUrlValue = (value: unknown): value is boolean | number | string =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

/**
 * Checks the call's shape against the tool's groups - not its values, which
 * the route validates as it always does - and builds the URL and body.
 */
const requestPartsOf = (
  tool: McpToolDescriptor,
  args: unknown,
): { body?: string; path: string; query: [string, string][] } => {
  const input = args ?? {};
  if (!isRecord(input)) {
    throw new McpArgumentsError("Arguments must be an object.");
  }

  const groups = Object.keys(tool.groups);
  for (const key of Object.keys(input)) {
    if (!groups.includes(key)) {
      throw new McpArgumentsError(
        groups.length > 0
          ? `Unknown argument "${key}". This tool takes ${groups.map(group => `"${group}"`).join(", ")}.`
          : `Unknown argument "${key}". This tool takes no arguments.`,
      );
    }
  }
  for (const [key, group] of Object.entries(tool.groups)) {
    if (group.required && input[key] === undefined) {
      throw new McpArgumentsError(`"${key}" is required.`);
    }
  }

  const params = input.params ?? {};
  if (!isRecord(params)) {
    throw new McpArgumentsError('"params" must be an object.');
  }
  const path = tool.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (!isUrlValue(value) || String(value) === "") {
      throw new McpArgumentsError(
        `"params.${name}" must be a non-empty string, number or boolean.`,
      );
    }
    const text = String(value);
    // The URL parser resolves these segments, which would move the request to
    // another route than the one this tool names.
    if (text === "." || text === "..") {
      throw new McpArgumentsError(`"params.${name}" cannot be "${text}".`);
    }

    return encodeURIComponent(text);
  });

  const query: [string, string][] = [];
  if (input.query !== undefined) {
    if (!isRecord(input.query)) {
      throw new McpArgumentsError('"query" must be an object.');
    }
    for (const [key, value] of Object.entries(input.query)) {
      if (value === undefined) continue;
      if (!isUrlValue(value)) {
        throw new McpArgumentsError(
          `"query.${key}" must be a string, number or boolean.`,
        );
      }
      query.push([key, String(value)]);
    }
  }

  return {
    // Sent as given - omitted keys stay omitted and `null` stays `null`, so a
    // partial update only touches what the call names.
    body:
      tool.groups.body && input.body !== undefined
        ? JSON.stringify(input.body)
        : undefined,
    path,
    query,
  };
};

/** Where and how a tool call is dispatched; built once per MCP request. */
export interface McpDispatchTarget {
  /** The API's base path, `/api` in the starter apps. */
  basePath: string;
  /** The outer request's Hono context: its env and execution context are reused. */
  c: Context;
  /** The app `VitNodeAPI` mounted everything on. */
  fetch: (
    request: Request,
    env?: unknown,
    executionCtx?: ExecutionContext,
  ) => Promise<Response> | Response;
  /** Largest response body read back, in bytes. */
  maxResponseBytes: number;
}

const executionContextOf = (c: Context): ExecutionContext | undefined => {
  try {
    return c.executionCtx;
  } catch {
    // Hono throws when the runtime passed no execution context.
    return undefined;
  }
};

/** Reads at most `limit` bytes; `null` when the body is longer. */
const readBounded = async (
  response: Response,
  limit: number,
): Promise<null | string> => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();

      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
};

const errorResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

const isJson = (response: Response): boolean =>
  /^application\/(?:[\w.+-]+\+)?json\b/i.test(
    response.headers.get("content-type") ?? "",
  );

/**
 * Turns the route's response into a tool result. Only the status and the body
 * are read - never a header, so no cookie, token or internal header reaches
 * the model. JSON objects become `structuredContent` as they are; arrays and
 * scalars are wrapped as `{ result }`. A 5xx body is replaced, so no stack
 * trace leaks; a body over the limit is refused rather than cut.
 */
export const toolResultOf = async (
  response: Response,
  maxResponseBytes: number,
): Promise<CallToolResult> => {
  const { status } = response;

  if (status >= 300 && status < 400) {
    await response.body?.cancel();

    return errorResult(
      `The route answered with a redirect (HTTP ${status}), which MCP tools do not follow.`,
    );
  }

  const text = await readBounded(response, maxResponseBytes);
  if (text === null) {
    return errorResult(
      `The response is larger than ${maxResponseBytes} bytes, the limit for one tool result. Narrow the request - a smaller page, fewer fields.`,
    );
  }

  if (status >= 500) {
    return errorResult(
      `The call failed with HTTP ${status}: Internal Server Error.`,
    );
  }

  let parsed: unknown;
  const hasBody = text.trim() !== "";
  if (hasBody && isJson(response)) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return errorResult(`The route returned malformed JSON (HTTP ${status}).`);
    }
  }

  if (status >= 400) {
    const detail = parsed === undefined ? text.trim() : JSON.stringify(parsed);

    return errorResult(
      detail
        ? `The call failed with HTTP ${status}: ${detail}`
        : `The call failed with HTTP ${status}.`,
    );
  }

  if (!hasBody) {
    return { content: [{ type: "text", text: `Done (HTTP ${status}).` }] };
  }

  if (parsed === undefined) {
    return errorResult(
      `The route returned ${response.headers.get("content-type") ?? "a body without a content type"}; MCP tools return JSON only.`,
    );
  }

  return {
    content: [{ type: "text", text: JSON.stringify(parsed) }],
    structuredContent: isRecord(parsed) ? parsed : { result: parsed },
  };
};

/**
 * Runs one tool call as one request to the tool's own route, in this process:
 * the full middleware chain, the route's guards, validation, hook and handler,
 * once each. The request carries no cookie and no credential - the principal
 * travels in a frame only this module can attach - and its URL is built from
 * the route's own path, so a call cannot reach another route or another host.
 *
 * @throws McpArgumentsError when the arguments do not fit the tool's groups.
 */
export const dispatchMcpTool = async (
  target: McpDispatchTarget,
  {
    args,
    frame,
    tool,
  }: {
    args: unknown;
    frame: McpDispatchFrame;
    tool: McpToolDescriptor;
  },
): Promise<CallToolResult> => {
  const { body, path, query } = requestPartsOf(tool, args);
  const expectedPath = `${target.basePath}/${tool.pluginId}${path}`;
  const url = new URL(expectedPath, new URL(target.c.req.url).origin);
  for (const [key, value] of query) url.searchParams.append(key, value);

  if (url.pathname !== expectedPath) {
    throw new McpArgumentsError(
      "The path parameters do not form a valid path.",
    );
  }

  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type", "application/json");
  const userAgent = target.c.req.header("user-agent");
  if (userAgent) headers.set("user-agent", userAgent.slice(0, 512));

  const request = new Request(url, {
    body,
    headers,
    method: tool.method,
    redirect: "manual",
  });
  pendingFrames.set(request, frame);

  const response = await target.fetch(
    request,
    target.c.env,
    executionContextOf(target.c),
  );

  return await toolResultOf(response, target.maxResponseBytes);
};
