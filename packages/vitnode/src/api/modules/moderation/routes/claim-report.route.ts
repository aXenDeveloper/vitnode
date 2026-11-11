import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import { auditDiff } from "@/lib/audit/diff";

import { recordReportAudit } from "../lib/audit";
import { stateOf } from "../lib/report-state";
import {
  appendReportEvent,
  authorizeReport,
  reportConflict,
  updateReport,
} from "../lib/reports";
import { expectedVersionBody, reportIdParams } from "../moderation.schema";
import { body, mutationResponses } from "../report-workflow.schema";

export const claimReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/claim",
    description:
      "Take a report: assigns it to the caller and moves it to in progress",
    request: { params: reportIdParams, ...body(expectedVersionBody) },
    responses: mutationResponses,
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { expectedVersion } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    if (report.version !== expectedVersion) throw reportConflict(report);
    if (report.status === "done") {
      throw reportConflict(report, "report_closed");
    }
    if (report.assigneeId !== null && report.assigneeId !== moderator.user.id) {
      throw reportConflict(report, "already_claimed");
    }

    const updated = await c.get("db").transaction(async tx => {
      const next = await updateReport(tx, report, {
        assigneeId: moderator.user.id,
        status: "in_progress",
      });
      await recordReportAudit(c, tx, report, {
        action: "claimed",
        changes: auditDiff({
          after: { assigneeId: moderator.user.id, status: "in_progress" },
          before: { assigneeId: report.assigneeId, status: report.status },
        }),
      });
      if (report.assigneeId !== moderator.user.id) {
        await appendReportEvent(tx, {
          actorId: moderator.user.id,
          data: { assigneeId: moderator.user.id, previousAssigneeId: null },
          reportId: report.id,
          type: "assigned",
        });
      }
      if (report.status !== "in_progress") {
        await appendReportEvent(tx, {
          actorId: moderator.user.id,
          data: { from: report.status, to: "in_progress" },
          reportId: report.id,
          type: "status_changed",
        });
      }

      return next;
    });

    await c.get("events").emit("moderation.report.assigned", {
      assigneeId: moderator.user.id,
      previousAssigneeId: report.assigneeId,
      reportId: report.id,
    });

    return c.json(stateOf(updated), 200);
  },
});
