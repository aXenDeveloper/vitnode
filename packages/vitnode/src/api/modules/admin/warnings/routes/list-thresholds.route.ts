import { z } from "@hono/zod-openapi";
import { asc } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_thresholds } from "@/database/warnings";
import { WARNING_THRESHOLD_ACTIONS } from "@/lib/moderation/warnings";

const thresholdSchema = z.object({
  id: z.number(),
  points: z.number(),
  action: z.enum(WARNING_THRESHOLD_ACTIONS),
  durationMinutes: z.number().nullable(),
  enabled: z.boolean(),
  updatedAt: z.date(),
});

export const listWarningThresholdsAdminRoute = buildRoute({
  adminStaffPermission: { module: "warning_settings", permission: "can_view" },
  route: {
    method: "get",
    path: "/thresholds",
    description: "Every warning threshold, lowest points first (Admin only)",
    responses: {
      200: json(
        z.object({ thresholds: z.array(thresholdSchema) }),
        "Warning thresholds",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const table = core_moderation_warning_thresholds;
    const thresholds = await c
      .get("db")
      .select({
        action: table.action,
        durationMinutes: table.durationMinutes,
        enabled: table.enabled,
        id: table.id,
        points: table.points,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .orderBy(asc(table.points), asc(table.id));

    return c.json({ thresholds }, 200);
  },
});
