import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { mcpTokenCreatedEvent } from "@/events/mcp";
import { mcpDispatchOf } from "@/lib/mcp/dispatch";
import { visibleMcpTools } from "@/lib/mcp/endpoint";
import { createMcpToken } from "@/lib/mcp/tokens";

import {
  MCP_TOKEN_LABEL_MAX_LENGTH,
  mcpTokenStatusOf,
  zodMcpError,
  zodMcpTokenSummary,
} from "../mcp.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export const createMcpTokenRoute = buildRoute({
  route: {
    method: "post",
    path: "/tokens",
    description:
      "Create an MCP token for the signed-in member, limited to the listed tools and an expiry. The token is returned once and never again.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              /** Days until the token stops working. */
              expiresInDays: z.number().int().min(1),
              label: z.string().trim().min(1).max(MCP_TOKEN_LABEL_MAX_LENGTH),
              /** Full tool names from `GET /mcp/tools`. */
              tools: z.array(z.string().min(1)).min(1).max(500),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              /** The bearer token. Shown once: only its hash is stored. */
              token: z.string(),
              tokenInfo: zodMcpTokenSummary,
            }),
          },
        },
        description: "Token created",
      },
      400: {
        content: { "application/json": { schema: zodMcpError } },
        description: "A tool this member may not grant, or too long a lifetime",
      },
      401: { description: "Not signed in" },
      403: { description: "Called through an MCP token" },
      404: {
        content: { "application/json": { schema: zodMcpError } },
        description: "MCP is turned off",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });
    // A token never mints another token.
    if (mcpDispatchOf(c)) throw new HTTPException(403);

    const { config, registry } = c.get("core").mcp;
    if (!config.enabled) return c.json({ error: "mcp_disabled" as const }, 404);

    const { expiresInDays, label, tools } = c.req.valid("json");
    if (expiresInDays > config.tokenMaxLifetimeDays) {
      return c.json({ error: "token_lifetime_too_long" as const }, 400);
    }

    // A token may only list tools its owner can use today. Losing a permission
    // later needs no reissue: every call is checked again.
    const grantable = new Set(
      (await visibleMcpTools(c, user, registry.tools)).map(tool => tool.name),
    );
    const refused = [...new Set(tools)].filter(name => !grantable.has(name));
    if (refused.length > 0) {
      return c.json(
        { error: "tools_not_available" as const, tools: refused.sort() },
        400,
      );
    }

    const { summary, token } = await createMcpToken(c, {
      expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
      label,
      tools,
      userId: user.id,
    });

    await c.get("audit").record({
      action: "mcp.token_created",
      metadata: { expiresInDays, tools: summary.tools.length },
      target: { id: summary.id, label: summary.label, type: "mcp_token" },
    });
    await c.get("events").emit(mcpTokenCreatedEvent, {
      expiresAt: summary.expiresAt.toISOString(),
      tokenId: summary.id,
      tools: summary.tools,
      userId: user.id,
    });

    return c.json(
      {
        token,
        tokenInfo: { ...summary, status: mcpTokenStatusOf(summary) },
      },
      201,
    );
  },
});
