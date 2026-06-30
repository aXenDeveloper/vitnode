import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

const permissionStaffModulesSchema = z.record(z.string(), z.array(z.string()));

export const permissionCatalogStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Get the staff permission catalog declared by every plugin (Admin only)",
    path: "/permission-catalog",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                pluginId: z.string(),
                admin: permissionStaffModulesSchema,
                moderator: permissionStaffModulesSchema,
              }),
            ),
          },
        },
        description: "Staff permission catalog",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: c => {
    return c.json(c.get("core").permissionStaff, 200);
  },
});
