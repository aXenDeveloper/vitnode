import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import { getDashboardWidgets, zodStoredDashboardWidget } from "../lib/layout";

export const getDashboardLayoutAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "dashboard", permission: "can_view" },
  route: {
    method: "get",
    description: "Get the signed-in admin's own dashboard widget layout",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              widgets: z.array(zodStoredDashboardWidget),
            }),
          },
        },
        description: "The admin's dashboard layout",
      },
    },
  },
  handler: async c => {
    const admin = c.get("admin")?.user;
    if (!admin) throw new HTTPException(403);

    return c.json({ widgets: await getDashboardWidgets(c, admin.id) }, 200);
  },
});
