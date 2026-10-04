import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { zodAiPricing } from "@/api/lib/ai/pricing";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_pricing } from "@/database/ai";

/**
 * Sets an admin price override for one model on its connection. It replaces
 * the catalog price from now on; earlier calls keep the price they were
 * charged at, because each one stored its own snapshot.
 */
export const updateAiPricingAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "put",
    description: "Set a manual price override for a model.",
    path: "/models/pricing",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ modelId: z.string(), pricing: zodAiPricing }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ version: z.string() }) },
        },
        description: "The new pricing version",
      },
      404: { description: "Unknown model" },
    },
  },
  handler: async c => {
    const { modelId, pricing } = c.req.valid("json");
    if (!c.get("core").ai?.models.some(entry => entry.id === modelId)) {
      throw new HTTPException(404, { message: "Unknown AI model" });
    }

    const id = await c.get("db").transaction(async tx => {
      await tx
        .update(core_ai_pricing)
        .set({ active: false })
        .where(
          and(
            eq(core_ai_pricing.modelId, modelId),
            eq(core_ai_pricing.source, "manual"),
            eq(core_ai_pricing.active, true),
          ),
        );
      const [row] = await tx
        .insert(core_ai_pricing)
        .values({
          createdById: c.get("admin")?.user.id ?? null,
          modelId,
          pricing,
          source: "manual",
        })
        .returning({ id: core_ai_pricing.id });

      return row.id;
    });

    return c.json({ version: `manual:${id}` }, 200);
  },
});

export const deleteAiPricingAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "delete",
    description: "Remove a model's manual price override.",
    path: "/models/pricing",
    request: { query: z.object({ modelId: z.string() }) },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Override removed; the catalog price applies again",
      },
    },
  },
  handler: async c => {
    const { modelId } = c.req.valid("query");
    await c
      .get("db")
      .update(core_ai_pricing)
      .set({ active: false })
      .where(
        and(
          eq(core_ai_pricing.modelId, modelId),
          eq(core_ai_pricing.source, "manual"),
          eq(core_ai_pricing.active, true),
        ),
      );

    return c.json({ ok: true as const }, 200);
  },
});
