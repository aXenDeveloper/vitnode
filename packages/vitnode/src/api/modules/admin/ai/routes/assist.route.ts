import {
  zodAiErrorBody,
  zodAiRunBody,
  zodAiRunResponse,
} from "@/api/lib/ai/run-schemas";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const assistAiAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Run a registered AI action for the signed-in admin.",
    path: "/assist",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiRunBody } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodAiRunResponse } },
        description: "The action's validated output and safe usage metadata",
      },
      403: {
        content: { "application/json": { schema: zodAiErrorBody } },
        description: "No access to the action or the content",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const result = await c.get("ai").run({
      ...body,
      resource: body.resource ?? undefined,
      signal: c.req.raw.signal,
    });

    return c.json(result, 200);
  },
});
