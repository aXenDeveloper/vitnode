import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import {
  readNavigationRecords,
  withNavigationPresets,
} from "../lib/read-navigation";
import { zodAdminNavigationItemSchema } from "../lib/schema";

export const listNavigationAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "navigation", permission: "can_view" },
  route: {
    method: "get",
    description: "Every main menu item, in menu order (Admin only)",
    path: "/list",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(zodAdminNavigationItemSchema),
            }),
          },
        },
        description: "Navigation items",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const records = await readNavigationRecords(c);

    return c.json(
      { items: withNavigationPresets(records, c.get("core").navigation) },
      200,
    );
  },
});
