import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import {
  isSettingsTooLarge,
  MAX_STORED_WIDGETS,
  mergeWidgetSettings,
  mutateDashboardWidgets,
  zodDashboardWidgetSettings,
  zodWidgetId,
} from "../lib/layout";

export const zodSaveWidgetSettingsSchema = z.object({
  settings: zodDashboardWidgetSettings,
  widgetId: zodWidgetId,
});

export const saveDashboardWidgetSettingsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "put",
    description:
      "Merge settings into a single widget on the signed-in admin's dashboard",
    path: "/widget-settings",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSaveWidgetSettingsSchema,
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
        description: "Widget settings saved",
      },
    },
  },
  handler: async c => {
    const admin = c.get("admin")?.user;
    if (!admin) throw new HTTPException(403);

    const { widgetId, settings } = c.req.valid("json");
    if (isSettingsTooLarge(settings)) {
      throw new HTTPException(413, { message: "Widget settings too large" });
    }

    await mutateDashboardWidgets(c, admin.id, previous => {
      // Only a brand new entry can grow the row, and only so far.
      const isNew = !previous.some(widget => widget.id === widgetId);
      if (isNew && previous.length >= MAX_STORED_WIDGETS) {
        throw new HTTPException(409, { message: "Too many widgets" });
      }

      return mergeWidgetSettings({ previous, settings, widgetId });
    });

    return c.json({ success: true }, 200);
  },
});
