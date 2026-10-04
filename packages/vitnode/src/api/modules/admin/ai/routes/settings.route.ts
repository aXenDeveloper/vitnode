import { formatDecimal, formatDecimalOrNull } from "@/api/lib/ai/decimal";
import {
  AI_POINTS_CONVERSION,
  AI_POINTS_CONVERSION_VERSION,
} from "@/api/lib/ai/ledger";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import { zodAiSettingsResponse } from "../schemas";

export const getAiSettingsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description: "Site-wide AI settings: switch, budgets, limits, ALT.",
    path: "/settings",
    responses: {
      200: {
        content: { "application/json": { schema: zodAiSettingsResponse } },
        description: "AI settings",
      },
    },
  },
  handler: async c => {
    const settings = await c.get("ai").ledger().loadSettings();

    return c.json(
      {
        altBatchSize: settings.altBatchSize,
        altEnabled: settings.altEnabled,
        altLanguages: settings.altLanguages,
        defaultMonthlyPoints: formatDecimal(settings.defaultMonthlyPoints),
        enabled: settings.enabled,
        historyRetentionDays: settings.historyRetentionDays,
        monthlyBudgetUsd: formatDecimalOrNull(settings.monthlyBudgetUsd),
        pointsConversion: {
          usdPerPoint:
            AI_POINTS_CONVERSION[AI_POINTS_CONVERSION_VERSION].usdPerPoint,
          version: AI_POINTS_CONVERSION_VERSION,
        },
        systemConcurrency: settings.systemConcurrency,
        systemMonthlyBudgetUsd: formatDecimalOrNull(
          settings.systemMonthlyBudgetUsd,
        ),
        timeZone: settings.timeZone,
        userConcurrency: settings.userConcurrency,
        userRequestsPerMinute: settings.userRequestsPerMinute,
      },
      200,
    );
  },
});
