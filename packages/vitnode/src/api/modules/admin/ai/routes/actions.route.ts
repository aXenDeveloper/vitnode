import { z } from "zod";

import {
  DEFAULT_AI_MODEL_CAPABILITIES,
  missingCapabilities,
} from "@/api/lib/ai/capabilities";
import { projectAiAction } from "@/api/lib/ai/registry";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_action_settings } from "@/database/ai";

import { zodAiAction } from "../schemas";

export const listAiActionsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Every plugin's AI actions with their settings and compatible models.",
    path: "/actions",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ actions: z.array(zodAiAction) }),
          },
        },
        description: "AI actions",
      },
    },
  },
  handler: async c => {
    const models = c.get("core").ai?.models ?? [];
    const rows = await c.get("db").select().from(core_ai_action_settings);

    return c.json(
      {
        actions: c
          .get("ai")
          .actions()
          .all()
          .map(action => {
            const metadata = projectAiAction(action);
            const row = rows.find(entry => entry.actionKey === action.key);

            return {
              ...metadata,
              compatibleModelIds: models
                .filter(
                  entry =>
                    missingCapabilities(
                      action.definition.requiredCapabilities,
                      entry.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES,
                    ).length === 0,
                )
                .map(entry => entry.id),
              settings: {
                dailyLimit: row?.dailyLimit ?? null,
                enabled: row?.enabled ?? true,
                fallbackModelId: row?.fallbackModelId ?? null,
                instructions: row?.instructions ?? null,
                maxInputCharacters: row?.maxInputCharacters ?? null,
                maxOutputTokens: row?.maxOutputTokens ?? null,
                maxRetries: row?.maxRetries ?? null,
                maxSteps: row?.maxSteps ?? null,
                modelId: row?.modelId ?? null,
                timeoutMs: row?.timeoutMs ?? null,
              },
            };
          }),
      },
      200,
    );
  },
});
