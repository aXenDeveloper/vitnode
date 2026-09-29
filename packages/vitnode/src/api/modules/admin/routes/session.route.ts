import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const sessionAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Verify admin session",
    path: "/session",
    request: {
      query: z.object({
        passive: z.literal("true").optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              user: z.object({
                id: z.number(),
                email: z.string(),
                name: z.string(),
                nameCode: z.string(),
                createdAt: z.date(),
                newsletter: z.boolean(),
                avatarColor: z.string(),
                avatarUrl: z.string().nullable(),
                coverUrl: z.string().nullable(),
                emailVerified: z.boolean(),
                roleId: z.number(),
                birthday: z.date().nullable(),
              }),
              permissions: z.object({
                root: z.boolean(),
                permissions: z.array(
                  z.object({
                    plugin: z.string(),
                    module: z.string(),
                    permission: z.string(),
                  }),
                ),
              }),
              vitnode_version: z.string(),
              expiresAt: z.date(),
            }),
          },
        },
        description: "User",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const user = c.get("admin")?.user;
    const expiresAt = c.get("adminSessionExpiresAt");
    if (!(user && expiresAt)) throw new HTTPException(403);

    const permissions = await resolveStaffPermissions(c, {
      type: "admin",
      user,
    });

    return c.json({
      user,
      permissions,
      vitnode_version: CONFIG_PLUGIN.version,
      expiresAt,
    });
  },
});
