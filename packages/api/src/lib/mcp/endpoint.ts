import type {
  CallToolResult,
  ListToolsResult,
  McpServerFactory,
  Tool,
} from "@modelcontextprotocol/server";
import type { Context, Hono, MiddlewareHandler } from "hono";

import {
  createMcpHandler,
  ProtocolError,
  ProtocolErrorCode,
  Server,
} from "@modelcontextprotocol/server";
import { routePath } from "hono/route";

import type { CacheClient } from "@/lib/cache";

import { withAuditContext } from "@/lib/audit/context";
import {
  checkStaffPermissionOfUser,
  isStaff,
} from "@/lib/check-staff-permission";
import { CONFIG } from "@/lib/config";
import { describeError } from "@/lib/error-details";
import { findActiveSuspension } from "@/lib/moderation/warnings/suspension";
import { manifest } from "@/manifest";
import { createRateLimiter } from "@/middlewares/rate-limiter.middleware";
import { UserModel } from "@/models/user";

import type { ResolvedMcpConfig } from "./config";
import type { McpDispatchFrame, McpPrincipal } from "./dispatch";
import type { McpRegistry, McpToolDescriptor } from "./registry";
import type { McpTokenGrant } from "./tokens";

import { runAfterResponse } from "../after-response";
import { auditCorrelationId } from "../audit/context";
import { dispatchMcpTool, McpArgumentsError } from "./dispatch";
import { touchMcpToken, verifyMcpToken } from "./tokens";

/** The path segment the MCP endpoints live under, below the API's base path. */
export const MCP_PATH_SEGMENT = "mcp";
const TOOLS_PAGE_SIZE = 50;

/**
 * Protocol revisions this endpoint is verified to serve with
 * `@modelcontextprotocol/server` 2.4.0: the 2026-07-28 per-request revision,
 * and the 2025-era revisions through the SDK's stateless fallback.
 */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;

type OwnerUser = NonNullable<Awaited<ReturnType<UserModel["getUserById"]>>>;
/** What a permission check needs to know about a user. */
interface StaffOwner {
  id: number;
  roleId: number;
}

/** Everything one MCP request's server instance needs; never shared. */
interface McpRequestSession {
  c: Context;
  correlationId: string;
  grant: McpTokenGrant;
  owner: OwnerUser;
  principal: McpPrincipal;
  /** Registry ∩ endpoint plugin ∩ token grants. */
  tools: readonly McpToolDescriptor[];
}

const sessions = new WeakMap<object, McpRequestSession>();

/**
 * Whether the owner may use a tool right now, from the route's declared
 * guards: the admin requirement of an `/admin/` path and its staff
 * permissions. Resource-level checks still run on every call, in the route.
 */
const ownerMaySee = async (
  c: Context,
  owner: StaffOwner,
  tool: McpToolDescriptor,
): Promise<boolean> => {
  if (
    tool.requiresAdmin &&
    !(await isStaff(c, { live: true, type: "admin", userId: owner.id }))
  ) {
    return false;
  }
  const { admin, moderator } = tool.staffPermissions ?? {};
  if (
    admin &&
    !(await checkStaffPermissionOfUser(c, owner, { type: "admin", ...admin }))
  ) {
    return false;
  }
  if (
    moderator &&
    !(await checkStaffPermissionOfUser(c, owner, {
      type: "moderator",
      ...moderator,
    }))
  ) {
    return false;
  }

  return true;
};

/** The tools a user may see, of those given - for `tools/list` and the token form. */
export const visibleMcpTools = async (
  c: Context,
  owner: StaffOwner,
  tools: readonly McpToolDescriptor[],
): Promise<McpToolDescriptor[]> => {
  const visible: McpToolDescriptor[] = [];
  for (const tool of tools) {
    if (await ownerMaySee(c, owner, tool)) visible.push(tool);
  }

  return visible;
};

const toolListing = (tool: McpToolDescriptor): Tool => ({
  name: tool.name,
  ...(tool.annotations?.title ? { title: tool.annotations.title } : {}),
  description: tool.description,
  inputSchema: tool.inputSchema as Tool["inputSchema"],
  ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
  ...(tool.annotations ? { annotations: tool.annotations } : {}),
});

const encodeCursor = (name: string): string =>
  btoa(name).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

const decodeCursor = (cursor: string): string => {
  try {
    return atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
  } catch {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Invalid cursor.");
  }
};

const recordInvocation = async (
  session: McpRequestSession,
  tool: McpToolDescriptor,
  {
    args,
    result,
  }: { args: unknown; result: "rejected_arguments" | CallToolResult },
): Promise<void> => {
  const params =
    typeof args === "object" && args !== null && "params" in args
      ? (args as { params?: unknown }).params
      : undefined;
  const rejected = result === "rejected_arguments";
  const targetId =
    !rejected && typeof params === "object" && params !== null && "id" in params
      ? String(params.id).slice(0, 64)
      : undefined;
  // Filed with the admins' log only when an admin made the call: a member
  // trying an admin tool is a member's request, refused by the route.
  const admin =
    tool.requiresAdmin &&
    (await isStaff(session.c, {
      type: "admin",
      userId: session.owner.id,
    }));

  // Arguments are not stored - an article body or a secret has no place in a
  // log - only which tool ran, for whom, through which token and how it went.
  await withAuditContext(
    session.c,
    {
      actor: { type: admin ? "staff" : "api", userId: session.owner.id },
      area: admin ? "admin" : "public",
      correlationId: session.correlationId,
    },
    async () =>
      await session.c.get("audit").record(
        {
          action: "mcp.tool_called",
          metadata: {
            outcome:
              result === "rejected_arguments"
                ? "rejected_arguments"
                : result.isError
                  ? "error"
                  : "success",
            plugin: tool.pluginId,
            tokenId: session.principal.tokenId,
            ...(targetId === undefined ? {} : { targetId }),
          },
          pluginId: manifest.id,
          target: { id: tool.name, label: tool.name, type: "mcp_tool" },
        },
        { bestEffort: true },
      ),
  );
};

const unauthorized = (c: Context, message: string): Response =>
  c.json({ error: message }, 401, {
    "WWW-Authenticate": 'Bearer realm="mcp"',
  });

/**
 * The MCP endpoints, `{base}/mcp` and `{base}/mcp/{pluginId}`, for
 * `VitNodeAPI` - only when `mcp.enabled` is on. `mark` goes in front of the
 * rate limiter, so `isMcpEndpoint` can tell it these requests apart; `mount`
 * registers the routes after the global middleware and before any plugin.
 *
 * Streamable HTTP through `@modelcontextprotocol/server`'s web-standard
 * handler: stateless, JSON responses, no session kept in memory, so it runs the
 * same on Node, Bun and Workers. Each request:
 *
 * 1. refuses a browser `Origin` other than the web app's or the API's own;
 * 2. verifies the bearer token - unknown, expired and revoked tokens get `401`
 *    - and loads its owner, refusing a deleted or suspended one;
 * 3. charges the token's own rate limit;
 * 4. builds a server instance for this request alone, whose tools are the
 *    registry's, narrowed to the endpoint's plugin and the token's grants -
 *    and, for `tools/list`, to what the owner's permissions allow;
 * 5. runs each tool call through the tool's own route in this process.
 */
export const createMcpEndpoints = ({
  app,
  cacheClient,
  config,
  registry,
}: {
  app: Hono;
  cacheClient: CacheClient | null;
  config: ResolvedMcpConfig;
  registry: McpRegistry;
}): {
  isMcpEndpoint: (c: Context) => boolean;
  mark: MiddlewareHandler;
  mount: () => void;
} => {
  const endpointRequests = new WeakSet<Context>();
  const mark: MiddlewareHandler = async (c, next) => {
    endpointRequests.add(c);
    await next();
  };

  const limiter = createRateLimiter({
    ...config.rateLimit,
    keyPrefix: "rl_mcp",
    storeClient: cacheClient,
  });

  const factory: McpServerFactory = ({ authInfo }) => {
    const session = authInfo?.extra?.session
      ? sessions.get(authInfo.extra.session)
      : undefined;
    if (!session) {
      throw new Error("MCP request without a verified session.");
    }

    // The low-level server on purpose: the catalog is built per request, from
    // the token's grants and the owner's permissions, and paged - which
    // `McpServer`'s register-once tool table does not model.
    // oxlint-disable-next-line typescript/no-deprecated
    const server = new Server(
      { name: "vitnode", title: "VitNode", version: manifest.version },
      { capabilities: { tools: { listChanged: false } } },
    );

    server.setRequestHandler(
      "tools/list",
      async (request): Promise<ListToolsResult> => {
        const cursor = request.params?.cursor;
        const after = cursor ? decodeCursor(cursor) : undefined;
        const visible = await visibleMcpTools(
          session.c,
          session.owner,
          session.tools,
        );
        const start =
          after === undefined
            ? 0
            : visible.findIndex(tool => tool.name > after);
        const page =
          start === -1 ? [] : visible.slice(start, start + TOOLS_PAGE_SIZE);
        const last = page.at(-1);
        const hasMore =
          start !== -1 && start + TOOLS_PAGE_SIZE < visible.length && last;

        return {
          tools: page.map(toolListing),
          ...(hasMore ? { nextCursor: encodeCursor(last.name) } : {}),
        };
      },
    );

    server.setRequestHandler(
      "tools/call",
      async (request): Promise<CallToolResult> => {
        const { arguments: args, name } = request.params;
        // A tool outside the token's grants answers exactly like one that does
        // not exist, so a token cannot probe what else the install offers.
        const tool = session.tools.find(entry => entry.name === name);
        if (!tool) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            `Unknown tool: ${name}`,
          );
        }

        const frame: McpDispatchFrame = {
          correlationId: session.correlationId,
          ipAddress: session.c.get("ipAddress"),
          principal: session.principal,
          tool: tool.name,
        };

        let result: CallToolResult;
        try {
          result = await dispatchMcpTool(
            {
              basePath: basePathOf(session.c),
              c: session.c,
              fetch: app.fetch,
              maxResponseBytes: config.maxResponseBytes,
            },
            { args, frame, tool },
          );
        } catch (error) {
          if (!(error instanceof McpArgumentsError)) throw error;
          await recordInvocation(session, tool, {
            args,
            result: "rejected_arguments",
          });

          return {
            content: [{ type: "text", text: error.message }],
            isError: true,
          };
        }

        await recordInvocation(session, tool, { args, result });

        return server.projectCallToolResult(result, tool.outputSchema);
      },
    );

    return server;
  };

  const handler = createMcpHandler(factory, {
    legacy: "stateless",
    maxRequestBodySize: config.maxRequestBytes,
    onerror: error => {
      // oxlint-disable-next-line no-console
      console.error(
        `\x1b[34m[VitNode]\x1b[0m \x1b[31mMCP error\x1b[0m: ${describeError(error)}`,
      );
    },
  });

  const serve = async (c: Context): Promise<Response> => {
    const pluginSegment = pluginSegmentOf(c);
    let pluginId: string | undefined;
    if (pluginSegment !== undefined) {
      try {
        pluginId = decodeURIComponent(pluginSegment);
      } catch {
        pluginId = undefined;
      }
      if (pluginId === undefined || !registry.pluginIds.includes(pluginId)) {
        return c.json({ error: "No MCP tools for this plugin." }, 404);
      }
    }

    // Browsers send an Origin; MCP clients do not. A page on another origin
    // must not be able to drive this endpoint (DNS rebinding included).
    const origin = c.req.header("origin");
    if (
      origin !== undefined &&
      origin !== CONFIG.web.origin &&
      origin !== new URL(c.req.url).origin
    ) {
      return c.json({ error: "Origin not allowed." }, 403);
    }

    const authorization = c.req.header("authorization") ?? "";
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!match) return unauthorized(c, "A bearer token is required.");

    const grant = await verifyMcpToken(c, match[1]);
    if (!grant) {
      return unauthorized(c, "The token is invalid, expired or revoked.");
    }

    const owner = await new UserModel().getUserById({ c, id: grant.userId });
    if (!owner) return unauthorized(c, "The token's owner no longer exists.");
    if (await findActiveSuspension(c, owner.id)) {
      return c.json({ error: "The token's owner is suspended." }, 403);
    }

    try {
      await limiter.consume(`token:${grant.id}`);
    } catch {
      return c.json({ error: "Too Many Requests" }, 429, {
        "Retry-After": `${config.rateLimit.duration}`,
      });
    }

    runAfterResponse(
      c,
      touchMcpToken(c, grant).catch(() => undefined),
    );

    const session: McpRequestSession = {
      c,
      correlationId: auditCorrelationId(c),
      grant,
      owner,
      principal: { tokenId: grant.id, userId: owner.id },
      tools: registry.tools.filter(
        tool =>
          grant.tools.has(tool.name) &&
          (pluginId === undefined || tool.pluginId === pluginId),
      ),
    };
    const key = {};
    sessions.set(key, session);

    return await handler.fetch(c.req.raw, {
      authInfo: {
        clientId: `mcp-token-${grant.id}`,
        expiresAt: undefined,
        extra: { session: key },
        scopes: [...grant.tools],
        token: `mcp-token-${grant.id}`,
      },
    });
  };

  return {
    isMcpEndpoint: c => endpointRequests.has(c),
    mark,
    mount: () => {
      app.all(`/${MCP_PATH_SEGMENT}`, serve);
      app.all(`/${MCP_PATH_SEGMENT}/*`, serve);
    },
  };
};

const MCP_ROUTE_SUFFIX = new RegExp(`/${MCP_PATH_SEGMENT}(?:/\\*)?$`);

/** The API's base path, read off the matched MCP route: `/api`. */
const basePathOf = (c: Context): string =>
  routePath(c).replace(MCP_ROUTE_SUFFIX, "");

/** The `{pluginId}` after `/mcp/`, still URL-encoded; `undefined` on `/mcp`. */
const pluginSegmentOf = (c: Context): string | undefined => {
  const prefix = `${basePathOf(c)}/${MCP_PATH_SEGMENT}`;
  const rest = c.req.path.slice(prefix.length).replace(/^\/|\/$/g, "");

  return rest === "" ? undefined : rest;
};
