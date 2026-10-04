import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

/**
 * Runs an action once with sample input, as the signed-in admin - through the
 * same authorization, limits and accounting as any other run. A test is a
 * real, billed operation and shows up in history like one.
 */
export const testAiActionAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "post",
    description: "Run an AI action once with sample input.",
    path: "/actions/test",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ input: z.unknown(), key: z.string() }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              output: z.unknown(),
              runId: z.number(),
              usage: z.object({
                chargedPoints: z.string(),
                costKnown: z.boolean(),
                modelId: z.string(),
              }),
            }),
          },
        },
        description: "The action's validated output",
      },
    },
  },
  handler: async c => {
    const { input, key } = c.req.valid("json");
    const result = await c.get("ai").run({ action: key, input });

    return c.json(result, 200);
  },
});
