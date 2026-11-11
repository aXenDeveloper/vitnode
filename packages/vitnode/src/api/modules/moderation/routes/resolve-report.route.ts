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
import {
  expectedVersionBody,
  optionalExplanationSchema,
  reportIdParams,
  resolutionSchema,
} from "../moderation.schema";
import { body, mutationResponses } from "../report-workflow.schema";

export const resolveReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/resolve",
    description:
      "Close a report with an outcome and an optional explanation. Related reports stay open",
    request: {
      params: reportIdParams,
      ...body(
        expectedVersionBody.extend({
          resolution: resolutionSchema,
          explanation: optionalExplanationSchema,
        }),
      ),
    },
    responses: mutationResponses,
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { expectedVersion, explanation, resolution } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    if (report.version !== expectedVersion) throw reportConflict(report);
    if (report.status === "done") {
      throw reportConflict(report, "report_closed");
    }

    const updated = await c.get("db").transaction(async tx => {
      const next = await updateReport(tx, report, {
        openKey: null,
        resolution,
        resolutionNote: explanation,
        resolvedAt: new Date(),
        resolvedById: moderator.user.id,
        status: "done",
      });
      await recordReportAudit(c, tx, report, {
        action: "resolved",
        changes: auditDiff({
          after: { resolution, status: "done" },
          before: { resolution: report.resolution, status: report.status },
        }),
        metadata: { withExplanation: Boolean(explanation) },
      });
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: explanation ? { explanation, resolution } : { resolution },
        reportId: report.id,
        type: "resolved",
      });

      return next;
    });

    await c.get("events").emit("moderation.report.resolved", {
      reportId: report.id,
      resolution,
    });

    return c.json(stateOf(updated), 200);
  },
});
