import { gateway } from "ai";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { syncGatewayPricing } from "@/api/lib/ai/maintenance";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const syncAiPricingAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "post",
    description:
      "Copy the AI Gateway's published prices onto gateway models. Direct provider connections are never priced from it.",
    path: "/models/sync-pricing",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              unchanged: z.array(z.string()),
              unpriced: z.array(z.string()),
              updated: z.array(z.string()),
            }),
          },
        },
        description: "Which models changed",
      },
      502: { description: "The gateway catalog could not be read" },
    },
  },
  handler: async c => {
    try {
      const result = await syncGatewayPricing(
        c.get("db"),
        c.get("core").ai?.models ?? [],
        async () => await gateway.getAvailableModels(),
      );

      return c.json(result, 200);
    } catch {
      throw new HTTPException(502, {
        message: "The AI Gateway price list could not be read.",
      });
    }
  },
});
