import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { canOnReport, requireModerator } from "@/api/lib/moderation/access";

import { recordReportAudit, withReportAudit } from "../lib/audit";
import { stateOf } from "../lib/report-state";
import {
  appendReportEvent,
  authorizeReport,
  reportConflict,
  reportError,
  updateReport,
} from "../lib/reports";
import {
  expectedVersionBody,
  json,
  reportIdParams,
  reportStateSchema,
} from "../moderation.schema";
import { body, mutationResponses } from "../report-workflow.schema";

export const reportActionRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/actions/{action}",
    description:
      "Hide or restore the reported content. Recorded in the report's timeline only when it succeeds",
    request: {
      params: reportIdParams.extend({ action: z.enum(["hide", "unhide"]) }),
      ...body(expectedVersionBody),
    },
    responses: {
      ...mutationResponses,
      200: json(
        reportStateSchema.extend({ changed: z.boolean() }),
        "The report's new state, and whether the content changed",
      ),
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { action, id } = c.req.valid("param");
    const { expectedVersion } = c.req.valid("json");
    const { report, target } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    if (report.version !== expectedVersion) throw reportConflict(report);
    const definition = target?.definition.actions?.[action];
    if (!target || !definition) {
      throw reportError(404, { error: "action_unavailable" });
    }
    const ref = {
      pluginId: report.pluginId,
      scopeId: report.scopeId,
      targetType: report.targetType,
    };
    if (!canOnReport(c, moderator.set, ref, definition.permission)) {
      throw reportError(403, { error: "forbidden" });
    }

    const result = await c.get("db").transaction(async tx => {
      // The content write the action performs is audited by its own owner (the
      // Content Engine's `content.hidden`) - as a moderator's, in the report's
      // scope.
      const outcome = await withReportAudit(
        c,
        report,
        async () =>
          await definition.run(c, {
            actorUserId: moderator.user.id,
            targetId: report.targetId,
            tx,
          }),
      );
      if (!outcome) return null;
      if (!outcome.changed) {
        return { outcome, state: stateOf(report) };
      }

      const next = await updateReport(tx, report, {});
      await appendReportEvent(tx, {
        actorId: moderator.user.id,
        data: { action },
        reportId: report.id,
        type: "action",
      });
      await recordReportAudit(c, tx, report, {
        action: "action_taken",
        metadata: { action },
      });

      return { outcome, state: stateOf(next) };
    });
    if (!result) throw reportError(404, { error: "target_gone" });

    if (result.outcome.changed) {
      await result.outcome.effects();
      await c.get("events").emit("moderation.report.action", {
        action,
        pluginId: report.pluginId,
        reportId: report.id,
        targetId: report.targetId,
        targetType: report.targetType,
      });
    }

    return c.json({ ...result.state, changed: result.outcome.changed }, 200);
  },
});
