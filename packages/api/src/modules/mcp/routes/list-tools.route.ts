import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { routePath } from "hono/route";

import { buildRoute } from "@/builders";
import { MCP_PATH_SEGMENT, visibleMcpTools } from "@/lib/mcp/endpoint";
import { manifest } from "@/manifest";

import { zodMcpToolSummary } from "../mcp.schema";

export const listMcpToolsRoute = buildRoute({
  route: {
    method: "get",
    path: "/tools",
    description:
      "The MCP tools the signed-in member may grant to a token, grouped by plugin, and whether MCP is on.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              enabled: z.boolean(),
              /** The install-wide MCP endpoint, absolute: `https://example.com/api/mcp`. */
              endpoint: z.string(),
              /** Largest `expiresInDays` a new token takes. */
              maxLifetimeDays: z.number().int(),
              plugins: z.array(
                z.object({
                  pluginId: z.string(),
                  tools: z.array(zodMcpToolSummary),
                }),
              ),
            }),
          },
        },
        description: "Grantable tools",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });

    const { config, registry } = c.get("core").mcp;
    const tools = config.enabled
      ? await visibleMcpTools(c, user, registry.tools)
      : [];
    const plugins = new Map<string, z.infer<typeof zodMcpToolSummary>[]>();
    for (const tool of tools) {
      const list = plugins.get(tool.pluginId) ?? [];
      list.push({
        annotations: tool.annotations,
        description: tool.description,
        name: tool.name,
        requiresAdmin: tool.requiresAdmin,
      });
      plugins.set(tool.pluginId, list);
    }

    // This route lives at `{base}/@vitnode/core/mcp/tools`; the endpoint at
    // `{base}/mcp`, whatever the app named its base path.
    const path = routePath(c);
    const base = path.slice(
      0,
      path.length - `/${manifest.id}/mcp/tools`.length,
    );

    return c.json(
      {
        enabled: config.enabled,
        endpoint: `${new URL(c.req.url).origin}${base}/${MCP_PATH_SEGMENT}`,
        maxLifetimeDays: config.tokenMaxLifetimeDays,
        plugins: [...plugins].map(([pluginId, entries]) => ({
          pluginId,
          tools: entries,
        })),
      },
      200,
    );
  },
});
