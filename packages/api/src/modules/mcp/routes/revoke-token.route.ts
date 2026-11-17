import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { mcpTokenRevokedEvent } from "@/events/mcp";
import { revokeMcpToken } from "@/lib/mcp/tokens";

import {
  mcpTokenStatusOf,
  zodMcpError,
  zodMcpTokenSummary,
} from "../mcp.schema";

export const revokeMcpTokenRoute = buildRoute({
  route: {
    method: "delete",
    path: "/tokens/{id}",
    description:
      "Revoke one of the signed-in member's MCP tokens. It stops working on its next request.",
    request: {
      params: z.object({ id: z.coerce.number().int().positive() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ tokenInfo: zodMcpTokenSummary }),
          },
        },
        description: "Token revoked",
      },
      401: { description: "Not signed in" },
      404: {
        content: { "application/json": { schema: zodMcpError } },
        description: "No live token of this member with that id",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });

    const { id } = c.req.valid("param");
    const revoked = await revokeMcpToken(c, { id, userId: user.id });
    if (!revoked) return c.json({ error: "token_not_found" as const }, 404);

    await c.get("audit").record({
      action: "mcp.token_revoked",
      target: { id: revoked.id, label: revoked.label, type: "mcp_token" },
    });
    await c.get("events").emit(mcpTokenRevokedEvent, {
      tokenId: revoked.id,
      userId: user.id,
    });

    return c.json(
      { tokenInfo: { ...revoked, status: mcpTokenStatusOf(revoked) } },
      200,
    );
  },
});
