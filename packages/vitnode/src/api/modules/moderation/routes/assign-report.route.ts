import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { moderationReportAssignedEvent } from "@/api/events/moderation";
import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { canOnReport, requireModerator } from "@/api/lib/moderation/access";
import { core_users } from "@/database/users";
import { auditDiff } from "@/lib/audit/diff";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

import { recordReportAudit } from "../lib/audit";
import { stateOf } from "../lib/report-state";
import {
  appendReportEvent,
  authorizeReport,
  reportConflict,
  reportError,
  updateReport,
} from "../lib/reports";
import { expectedVersionBody, reportIdParams } from "../moderation.schema";
import { body, mutationResponses } from "../report-workflow.schema";

export const assignReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/assign",
    description:
      "Reassign a report to another moderator who may manage it, or unassign it",
    request: {
      params: reportIdParams,
      ...body(
        expectedVersionBody.extend({
          assigneeId: z.number().int().positive().nullable(),
        }),
      ),
    },
    responses: mutationResponses,
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { assigneeId, expectedVersion } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    if (report.version !== expectedVersion) throw reportConflict(report);
    if (report.status === "done") {
      throw reportConflict(report, "report_closed");
    }
    if (report.assigneeId === assigneeId) {
      return c.json(stateOf(report), 200);
    }

    if (assigneeId !== null) {
      const [user] = await c
        .get("db")
        .select({ id: core_users.id, roleId: core_users.roleId })
        .from(core_users)
        .where(eq(core_users.id, assigneeId))
        .limit(1);
      const set = user
        ? await resolveStaffPermissions(c, { type: "moderator", user })
        : null;
      const eligible =
        set?.staff === true &&
        canOnReport(
          c,
          set,
          {
            pluginId: report.pluginId,
            scopeId: report.scopeId,
            targetType: report.targetType,
          },
          MODERATION_PERMISSIONS.manageReports,
        );
      if (!eligible) {
        throw reportError(400, { error: "assignee_not_eligible" });
      }
    }

    const status = assigneeId === null ? "new" : "in_progress";
    const updated = await c.get("db").transaction(async tx => {
      const next = await updateReport(tx, report, { assigneeId, status });
      await recordReportAudit(c, tx, report, {
        action: assigneeId === null ? "unassigned" : "assigned",
        changes: auditDiff({
          after: { assigneeId, status },
          before: { assigneeId: report.assigneeId, status: report.status },
        }),
      });
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: { assigneeId, previousAssigneeId: report.assigneeId },
        reportId: report.id,
        type: assigneeId === null ? "unassigned" : "assigned",
      });
      if (report.status !== status) {
        await appendReportEvent(tx, {
          actorId: moderator.user.id,
          data: { from: report.status, to: status },
          reportId: report.id,
          type: "status_changed",
        });
      }

      return next;
    });

    await c.get("events").emit(moderationReportAssignedEvent, {
      assigneeId,
      previousAssigneeId: report.assigneeId,
      reportId: report.id,
    });

    return c.json(stateOf(updated), 200);
  },
});
