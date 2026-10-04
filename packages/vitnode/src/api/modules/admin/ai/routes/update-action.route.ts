import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import {
  DEFAULT_AI_MODEL_CAPABILITIES,
  missingCapabilities,
} from "@/api/lib/ai/capabilities";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_action_settings } from "@/database/ai";

import { zodAiActionSettingsInput } from "../schemas";

export const updateAiActionAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "put",
    description:
      "Configure one AI action: switch, model, fallback, limits and editorial instructions.",
    path: "/actions",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiActionSettingsInput } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
      400: { description: "A model lacks a capability the action needs" },
      404: { description: "Unknown action" },
    },
  },
  handler: async c => {
    const { key, ...values } = c.req.valid("json");
    const action = c.get("ai").actions().find(key);
    if (!action) {
      throw new HTTPException(404, { message: "Unknown AI action" });
    }

    const models = c.get("core").ai?.models ?? [];
    for (const modelId of [values.modelId, values.fallbackModelId]) {
      if (modelId === null) continue;
      const entry = models.find(model => model.id === modelId);
      const missing = entry
        ? missingCapabilities(
            action.definition.requiredCapabilities,
            entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES,
          )
        : ["configured"];
      if (missing.length > 0) {
        throw new HTTPException(400, {
          message: `Model "${modelId}" cannot run this action (missing: ${missing.join(", ")}).`,
        });
      }
    }

    await c
      .get("db")
      .insert(core_ai_action_settings)
      .values({ actionKey: key, ...values })
      .onConflictDoUpdate({
        set: values,
        target: core_ai_action_settings.actionKey,
      });

    return c.json({ ok: true as const }, 200);
  },
});
