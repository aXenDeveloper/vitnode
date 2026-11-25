import { z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_mcp_clients, core_mcp_grants } from "@/database/mcp";
import { revokeMcpGrantsWhere } from "@/lib/mcp/oauth/grants";

import {
  requireMcpMember,
  zodMcpErrorResponse,
  zodMcpScope,
} from "../lib/schema";

const disabled = zodMcpErrorResponse(
  ["mcp_disabled"],
  "MCP is not enabled on this site",
);

export const listMcpConnectionsRoute = buildRoute({
  route: {
    method: "get",
    description:
      "List the AI clients the signed-in member connected over MCP, most recently used first.",
    path: "/connections",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                z.object({
                  id: z.number().int(),
                  client: z.object({
                    name: z.string(),
                    uri: z.string().nullable(),
                  }),
                  scopes: z.array(zodMcpScope),
                  createdAt: z.string(),
                  lastUsedAt: z.string(),
                }),
              ),
            }),
          },
        },
        description: "The member's MCP connections",
      },
      401: { description: "Not signed in" },
      404: disabled,
    },
  },
  handler: async c => {
    const user = requireMcpMember(c);
    if (!user) return c.json({ error: "mcp_disabled" as const }, 404);

    const rows = await c
      .get("db")
      .select({
        createdAt: core_mcp_grants.createdAt,
        id: core_mcp_grants.id,
        lastUsedAt: core_mcp_grants.lastUsedAt,
        name: core_mcp_clients.name,
        scopes: core_mcp_grants.scopes,
        uri: core_mcp_clients.uri,
      })
      .from(core_mcp_grants)
      .innerJoin(
        core_mcp_clients,
        eq(core_mcp_clients.id, core_mcp_grants.clientId),
      )
      .where(eq(core_mcp_grants.userId, user.id))
      .orderBy(desc(core_mcp_grants.lastUsedAt), desc(core_mcp_grants.id))
      .limit(100);

    return c.json(
      {
        items: rows.map(row => ({
          id: row.id,
          client: { name: row.name, uri: row.uri },
          scopes: row.scopes,
          createdAt: row.createdAt.toISOString(),
          lastUsedAt: row.lastUsedAt.toISOString(),
        })),
      },
      200,
    );
  },
});

export const revokeMcpConnectionRoute = buildRoute({
  route: {
    method: "delete",
    description:
      "Disconnect one of the signed-in member's MCP clients. Its tokens stop working at once.",
    path: "/connections/{id}",
    request: {
      params: z.object({
        id: z
          .string()
          .regex(/^\d{1,9}$/, "Must be a whole number.")
          .openapi({ example: "1" }),
      }),
    },
    responses: {
      200: { description: "Connection revoked" },
      401: { description: "Not signed in" },
      404: zodMcpErrorResponse(
        ["mcp_disabled", "not_found"],
        "MCP is off, or the member has no such connection",
      ),
    },
  },
  handler: async c => {
    const user = requireMcpMember(c);
    if (!user) return c.json({ error: "mcp_disabled" as const }, 404);

    const revoked = await revokeMcpGrantsWhere(
      c,
      and(
        eq(core_mcp_grants.id, Number(c.req.valid("param").id)),
        eq(core_mcp_grants.userId, user.id),
      ),
      "user",
    );
    if (revoked === 0) return c.json({ error: "not_found" as const }, 404);

    return c.body(null, 200);
  },
});
