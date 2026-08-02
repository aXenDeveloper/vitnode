import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import {
  mergeLayoutForSave,
  mutateDashboardWidgets,
  zodDashboardLayout,
} from "../lib/layout";

export const zodSaveDashboardLayoutSchema = zodDashboardLayout;

export const saveDashboardLayoutAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "dashboard", permission: "can_edit" },
  route: {
    method: "put",
    description:
      "Replace the signed-in admin's dashboard layout (order, spans and rows)",
    path: "/layout",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSaveDashboardLayoutSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: "Layout saved",
      },
    },
  },
  handler: async c => {
    const admin = c.get("admin")?.user;
    if (!admin) throw new HTTPException(403);

    const { managed, widgets } = c.req.valid("json");

    await mutateDashboardWidgets(c, admin.id, previous =>
      mergeLayoutForSave({ incoming: widgets, managed, previous }),
    );

    return c.json({ success: true }, 200);
  },
});
