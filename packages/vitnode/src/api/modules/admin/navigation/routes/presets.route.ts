import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import { zodNavigationPresetSchema } from "../lib/schema";

export const presetsNavigationAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "navigation", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Every prebuilt menu item the installed plugins offer (Admin only)",
    path: "/presets",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              presets: z.array(zodNavigationPresetSchema),
            }),
          },
        },
        description: "Navigation presets",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: c => c.json({ presets: c.get("core").navigation }, 200),
});
