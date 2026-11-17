import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { listMcpTokens } from "@/lib/mcp/tokens";

import { mcpTokenStatusOf, zodMcpTokenSummary } from "../mcp.schema";

export const listMcpTokensRoute = buildRoute({
  route: {
    method: "get",
    path: "/tokens",
    description:
      "The signed-in member's MCP tokens, newest first - never the tokens themselves.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ tokens: z.array(zodMcpTokenSummary) }),
          },
        },
        description: "The member's tokens",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });

    const tokens = await listMcpTokens(c, user.id);

    return c.json(
      {
        tokens: tokens.map(token => ({
          ...token,
          status: mcpTokenStatusOf(token),
        })),
      },
      200,
    );
  },
});
