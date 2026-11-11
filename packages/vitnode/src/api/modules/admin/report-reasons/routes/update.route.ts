import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationReportReasonUpdatedEvent } from "@/api/events/moderation";
import { multiLangAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { errorSchema, json } from "@/api/modules/moderation/moderation.schema";
import { core_moderation_report_reasons } from "@/database/moderation";
import { auditDiff } from "@/lib/audit/diff";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { findReasonRow } from "../lib/reason-rows";
import { saveReasonWords } from "../lib/reason-words";
import { idParams, reasonBody } from "../report-reasons.schema";

export const updateReportReasonAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.report_reasons.canEdit,
  route: {
    method: "patch",
    path: "/{id}",
    description:
      "Edit a report reason (Admin only). Existing reports show the new title",
    request: {
      params: idParams,
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody.partial() } },
      },
    },
    responses: {
      200: json(z.object({ id: z.number() }), "Report reason updated"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Report reason not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const row = await findReasonRow(c, id);
    if (!row) return c.json({ error: "not_found" }, 404);

    await c.get("db").transaction(async tx => {
      if (body.requiresDetails !== undefined) {
        await tx
          .update(core_moderation_report_reasons)
          .set({ requiresDetails: body.requiresDetails })
          .where(eq(core_moderation_report_reasons.id, id));
      }
      await writeAuditLog(
        c,
        {
          action: "report_reason.updated",
          changes: auditDiff({
            after: {
              requiresDetails: body.requiresDetails ?? row.requiresDetails,
              ...(body.title === undefined
                ? {}
                : { title: multiLangAuditLabel(body.title) }),
            },
            before: { requiresDetails: row.requiresDetails },
          }),
          metadata:
            body.description === undefined ? {} : { descriptionChanged: true },
          target: {
            id,
            label: multiLangAuditLabel(body.title) ?? row.code,
            type: "report_reason",
          },
        },
        tx,
      );
    });
    await saveReasonWords(c, id, body);
    await c.get("events").emit(moderationReportReasonUpdatedEvent, {
      code: row.code,
      reasonId: id,
    });

    return c.json({ id }, 200);
  },
});
