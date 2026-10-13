import { z } from "zod";

import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const permissionsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Get the current user's effective moderator permissions (public site)",
    path: "/permissions",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              root: z.boolean(),
              permissions: z.array(
                z.object({
                  plugin: z.string(),
                  module: z.string(),
                  permission: z.string(),
                  scope: z
                    .discriminatedUnion("mode", [
                      z.object({ family: z.string(), mode: z.literal("all") }),
                      z.object({
                        family: z.string(),
                        mode: z.literal("selected"),
                        ids: z.array(z.string()),
                      }),
                    ])
                    .optional(),
                }),
              ),
            }),
          },
        },
        description: "Effective moderator permissions",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      return c.json({ root: false, permissions: [] }, 200);
    }

    const permissions = await resolveStaffPermissions(c, {
      type: "moderator",
      user,
    });

    return c.json(permissions, 200);
  },
});
