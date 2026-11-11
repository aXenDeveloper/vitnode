import { buildRoute } from "@/api/builders";
import { formatDecimal, formatDecimalOrNull } from "@/api/lib/ai/decimal";
import {
  AI_POINTS_CONVERSION,
  AI_POINTS_CONVERSION_VERSION,
} from "@/api/lib/ai/ledger";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodAiSettingsResponse } from "../ai.schema";

export const getAiSettingsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canView,
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
