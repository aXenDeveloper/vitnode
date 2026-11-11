import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationWarningThresholdDeletedEvent } from "@/api/events/moderation";
import { writeAuditLog } from "@/api/lib/audit/write";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_warning_thresholds } from "@/database/warnings";
import { auditDiff } from "@/lib/audit/diff";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { TARGET } from "../lib/threshold-rows";
import { idParams } from "../warning-thresholds.schema";

export const deleteWarningThresholdAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.warning_settings.canManage,
  route: {
    method: "delete",
    path: "/thresholds/{id}",
    description:
      "Delete a threshold (Admin only). Suspensions it created stay and keep a copy of the rule",
    request: { params: idParams },
    responses: {
      200: { description: "Threshold deleted" },
      403: { description: "Access Denied" },
      404: json(errorSchema, "Threshold not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const table = core_moderation_warning_thresholds;
    const deleted = await c.get("db").transaction(async tx => {
      const [row] = await tx.delete(table).where(eq(table.id, id)).returning({
        action: table.action,
        durationMinutes: table.durationMinutes,
        enabled: table.enabled,
        points: table.points,
      });
      if (!row) return false;
      await writeAuditLog(
        c,
        {
          action: "warning_threshold.deleted",
          changes: auditDiff({ after: null, before: row }),
          target: { id, label: String(row.points), type: TARGET },
        },
        tx,
      );

      return true;
    });
    if (!deleted) return c.json({ error: "not_found" }, 404);

    await c
      .get("events")
      .emit(moderationWarningThresholdDeletedEvent, { thresholdId: id });

    return c.body(null, 200);
  },
});
