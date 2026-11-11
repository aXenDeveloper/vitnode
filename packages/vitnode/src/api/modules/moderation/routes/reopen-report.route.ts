import { and, eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import { core_moderation_reports } from "@/database/moderation";
import { auditDiff } from "@/lib/audit/diff";

import { recordReportAudit } from "../lib/audit";
import { stateOf } from "../lib/report-state";
import {
  appendReportEvent,
  authorizeReport,
  reportConflict,
  reportOpenKey,
  updateReport,
} from "../lib/reports";
import {
  expectedVersionBody,
  noteSchema,
  reportIdParams,
} from "../moderation.schema";
import { body, mutationResponses } from "../report-workflow.schema";

export const reopenReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/reopen",
    description: "Reopen a closed report. Needs a reason, kept in the timeline",
    request: {
      params: reportIdParams,
      ...body(expectedVersionBody.extend({ reason: noteSchema })),
    },
    responses: mutationResponses,
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { expectedVersion, reason } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    if (report.version !== expectedVersion) throw reportConflict(report);
    if (report.status !== "done") {
      throw reportConflict(report, "report_open");
    }

    const status = report.assigneeId === null ? "new" : "in_progress";
    const updated = await c.get("db").transaction(async tx => {
      const key =
        report.reporterId === null
          ? null
          : reportOpenKey({
              pluginId: report.pluginId,
              reporterId: report.reporterId,
              targetId: report.targetId,
              targetType: report.targetType,
            });
      const [holder] = key
        ? await tx
            .select({ id: core_moderation_reports.id })
            .from(core_moderation_reports)
            .where(and(eq(core_moderation_reports.openKey, key)))
            .limit(1)
        : [];

      const next = await updateReport(tx, report, {
        openKey: holder ? null : key,
        resolution: null,
        resolutionNote: null,
        resolvedAt: null,
        resolvedById: null,
        status,
      });
      await recordReportAudit(c, tx, report, {
        action: "reopened",
        changes: auditDiff({
          after: { resolution: null, status },
          before: { resolution: report.resolution, status: report.status },
        }),
      });
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: {
          previousResolution: report.resolution,
          reason,
        },
        reportId: report.id,
        type: "reopened",
      });

      return next;
    });

    await c.get("events").emit("moderation.report.reopened", {
      reportId: report.id,
    });

    return c.json(stateOf(updated), 200);
  },
});
