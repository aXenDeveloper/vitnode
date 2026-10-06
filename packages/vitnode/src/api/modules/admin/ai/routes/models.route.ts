import { z } from "zod";

import { DEFAULT_AI_MODEL_CAPABILITIES } from "@/api/lib/ai/capabilities";
import { providerIdOf, providerModelIdOf } from "@/api/lib/ai/runner";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import { zodAiModel } from "../schemas";

/**
 * Models from `vitnode.api.config.ts`, read only - their capabilities and
 * price live in the config. Provider objects and keys never leave the server.
 */
export const listAiModelsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description: "Configured AI models, their capabilities and pricing.",
    path: "/models",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ models: z.array(zodAiModel) }),
          },
        },
        description: "AI models",
      },
    },
  },
  handler: c => {
    const models = c.get("core").ai?.models ?? [];

    return c.json(
      {
        models: models.map(entry => ({
          capabilities: [
            ...(entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES),
          ],
          id: entry.id,
          model: providerModelIdOf(entry.model),
          name: entry.name,
          pricing: entry.pricing ?? null,
          provider: providerIdOf(entry.model),
        })),
      },
      200,
    );
  },
});
