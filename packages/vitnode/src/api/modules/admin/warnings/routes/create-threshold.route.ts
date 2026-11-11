import { z } from "@hono/zod-openapi";
import { count } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationWarningThresholdCreatedEvent } from "@/api/events/moderation";
import { writeAuditLog } from "@/api/lib/audit/write";
import { json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_thresholds } from "@/database/warnings";
import { auditDiff } from "@/lib/audit/diff";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import { LOCK_THRESHOLDS, pointsTaken, TARGET } from "../lib/threshold-rows";
import { responses, thresholdBody } from "../warning-thresholds.schema";

export const createWarningThresholdAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.warning_settings.canManage,
  route: {
    method: "post",
    path: "/thresholds",
    description:
      "Add a threshold (Admin only). It applies to warnings issued from now on; members already above it are not suspended",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: thresholdBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Threshold created"),
      ...responses,
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const table = core_moderation_warning_thresholds;
    const result = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_THRESHOLDS);
      const [{ total }] = await tx.select({ total: count() }).from(table);
      if (total >= WARNING_LIMITS.maxThresholds) {
        return { error: "limit_reached" } as const;
      }
      if (body.enabled && (await pointsTaken(tx, body.points))) {
        return { error: "duplicate_points" } as const;
      }

      const [row] = await tx
        .insert(table)
        .values(body)
        .returning({ id: table.id });
      await writeAuditLog(
        c,
        {
          action: "warning_threshold.created",
          changes: auditDiff({ after: body, before: null }),
          target: { id: row.id, label: String(body.points), type: TARGET },
        },
        tx,
      );

      return { id: row.id };
    });
    if ("error" in result) return c.json({ error: result.error }, 409);

    await c
      .get("events")
      .emit(moderationWarningThresholdCreatedEvent, { thresholdId: result.id });

    return c.json({ id: result.id }, 201);
  },
});
