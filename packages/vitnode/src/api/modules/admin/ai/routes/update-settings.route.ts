import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { saveAiSettings } from "@/api/lib/ai/settings-store";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import { zodAiSettings } from "../schemas";

export const updateAiSettingsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "put",
    description: "Update site-wide AI settings.",
    path: "/settings",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiSettings } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
      400: { description: "Automatic ALT needs a site budget" },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    if (body.altEnabled && body.monthlyBudgetUsd === null) {
      throw new HTTPException(400, {
        message:
          "Set a monthly site budget before turning on automatic ALT text.",
      });
    }

    await saveAiSettings(c.get("db"), body);

    return c.json({ ok: true as const }, 200);
  },
});
