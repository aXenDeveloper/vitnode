import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { DEFAULT_AI_MODEL_CAPABILITIES } from "@/api/lib/ai/capabilities";
import { pricingFingerprint } from "@/api/lib/ai/pricing";
import { providerIdOf, providerModelIdOf } from "@/api/lib/ai/runner";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_pricing } from "@/database/ai";

import { zodAiModel } from "../schemas";

/**
 * Configured models with their capabilities and the price that applies on
 * their connection. Provider objects and keys never leave the server.
 */
export const listAiModelsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description: "Registered AI models, capabilities and pricing.",
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
  handler: async c => {
    const models = c.get("core").ai?.models ?? [];
    const rows = await c
      .get("db")
      .select()
      .from(core_ai_pricing)
      .where(and(eq(core_ai_pricing.active, true)));

    return c.json(
      {
        models: models.map(entry => {
          const manual = rows.find(
            row => row.modelId === entry.id && row.source === "manual",
          );
          const sync = rows.find(
            row => row.modelId === entry.id && row.source === "sync",
          );
          const stored = manual ?? sync;
          const catalog = sync?.pricing ?? entry.pricing ?? null;
          let pricing: z.infer<typeof zodAiModel>["pricing"] = null;
          if (stored) {
            pricing = {
              pricing: stored.pricing,
              source: stored.source,
              updatedAt: stored.createdAt.toISOString(),
              version: `${stored.source}:${stored.id}`,
            };
          } else if (entry.pricing) {
            pricing = {
              pricing: entry.pricing,
              source: "config",
              updatedAt: null,
              version: `config:${pricingFingerprint(entry.pricing)}`,
            };
          }

          return {
            capabilities: [
              ...(entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES),
            ],
            catalogPricing: manual ? catalog : null,
            id: entry.id,
            model: providerModelIdOf(entry.model),
            name: entry.name,
            pricing,
            provider: providerIdOf(entry.model),
          };
        }),
      },
      200,
    );
  },
});
