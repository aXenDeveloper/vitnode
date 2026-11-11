import { and, count, eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationReportReasonDeletedEvent } from "@/api/events/moderation";
import { writeAuditLog } from "@/api/lib/audit/write";
import { REPORT_REASON_WORDS } from "@/api/lib/moderation/report-reasons";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_languages_words } from "@/database/languages";
import { core_moderation_report_reasons } from "@/database/moderation";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { findReasonRow, LOCK_REASONS } from "../lib/reason-rows";
import { idParams } from "../report-reasons.schema";

export const deleteReportReasonAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.report_reasons.canDelete,
  route: {
    method: "delete",
    path: "/{id}",
    description:
      "Delete a report reason (Admin only). Reports filed with it keep the report but lose the reason's title. The last reason cannot be deleted",
    request: { params: idParams },
    responses: {
      200: { description: "Report reason deleted" },
      403: { description: "Access Denied" },
      404: json(errorSchema, "Report reason not found"),
      409: json(errorSchema, "The last reason cannot be deleted"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const row = await findReasonRow(c, id);
    if (!row) return c.json({ error: "not_found" }, 404);

    const deleted = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REASONS);
      const [{ total }] = await tx
        .select({ total: count() })
        .from(core_moderation_report_reasons);
      if (total <= 1) return false;

      await tx
        .delete(core_languages_words)
        .where(
          and(
            eq(core_languages_words.pluginCode, REPORT_REASON_WORDS.pluginCode),
            eq(core_languages_words.tableName, REPORT_REASON_WORDS.tableName),
            eq(core_languages_words.itemId, id),
          ),
        );
      await tx
        .delete(core_moderation_report_reasons)
        .where(eq(core_moderation_report_reasons.id, id));
      await writeAuditLog(
        c,
        {
          action: "report_reason.deleted",
          target: { id, label: row.code, type: "report_reason" },
        },
        tx,
      );

      return true;
    });
    if (!deleted) return c.json({ error: "last_reason" }, 409);

    await c.get("events").emit(moderationReportReasonDeletedEvent, {
      code: row.code,
      reasonId: id,
    });

    return c.body(null, 200);
  },
});
