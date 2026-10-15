import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { canOnReport, requireModerator } from "@/api/lib/moderation/access";
import { core_moderation_reports } from "@/database/moderation";
import { core_users } from "@/database/users";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

import { listModeratorCandidates } from "../lib/candidates";
import { loadReportPeople } from "../lib/people";
import {
  appendReportEvent,
  authorizeReport,
  reportConflict,
  reportError,
  reportOpenKey,
  updateReport,
} from "../lib/reports";
import {
  conflictSchema,
  errorSchema,
  expectedVersionBody,
  json,
  noteSchema,
  optionalExplanationSchema,
  reportIdParams,
  reportPersonSchema,
  reportStateSchema,
  resolutionSchema,
  richNoteSchema,
} from "../lib/schema";

const stateOf = (report: {
  assigneeId: null | number;
  status: "done" | "in_progress" | "new";
  version: number;
}) => ({
  assigneeId: report.assigneeId,
  status: report.status,
  version: report.version,
});

const mutationResponses = {
  200: json(reportStateSchema, "The report's new state"),
  400: { description: "Invalid input" },
  401: { description: "Sign in first" },
  403: json(errorSchema, "The moderator may not manage this report"),
  404: json(errorSchema, "No such report, or not one this moderator may see"),
  409: json(
    conflictSchema,
    "The report changed since it was read, or is in the wrong state",
  ),
};

const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});

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

    await c.get("events").emit("moderation.report.assigned", {
      assigneeId,
      previousAssigneeId: report.assigneeId,
      reportId: report.id,
    });

    return c.json(stateOf(updated), 200);
  },
});

export const noteReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports/{id}/notes",
    description:
      "Add an internal note to the report's timeline. Notes are visible to moderators only",
    request: {
      params: reportIdParams,
      ...body(z.object({ body: richNoteSchema })),
    },
    responses: {
      201: json(z.object({ ok: z.boolean() }), "Note added"),
      400: mutationResponses[400],
      401: mutationResponses[401],
      403: mutationResponses[403],
      404: mutationResponses[404],
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { body: note } = c.req.valid("json");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });

    await appendReportEvent(c.get("db"), {
      actorId: moderator.user.id,
      data: { body: note },
      reportId: report.id,
      type: "note",
    });

    return c.json({ ok: true }, 201);
  },
});

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
      const outcome = await definition.run(c, {
        actorUserId: moderator.user.id,
        targetId: report.targetId,
        tx,
      });
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

export const reportAssigneesRoute = buildRoute({
  route: {
    method: "get",
    path: "/reports/{id}/assignees",
    description: "Moderators who may manage this report, for reassignment",
    request: { params: reportIdParams },
    responses: {
      200: json(z.array(reportPersonSchema), "Eligible moderators"),
      401: mutationResponses[401],
      403: mutationResponses[403],
      404: mutationResponses[404],
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { report } = await authorizeReport(c, moderator, id, {
      manage: true,
    });
    const candidates = await listModeratorCandidates(c);

    const resolved = await Promise.all(
      candidates.map(async user => ({
        id: user.id,
        set: await resolveStaffPermissions(c, { type: "moderator", user }),
      })),
    );
    const eligible = resolved
      .filter(
        ({ set }) =>
          set.staff &&
          canOnReport(
            c,
            set,
            {
              pluginId: report.pluginId,
              scopeId: report.scopeId,
              targetType: report.targetType,
            },
            MODERATION_PERMISSIONS.manageReports,
          ),
      )
      .map(({ id }) => id);
    const people = await loadReportPeople(c, eligible);

    return c.json(
      eligible.flatMap(userId => {
        const person = people.get(userId);

        return person ? [person] : [];
      }),
      200,
    );
  },
});
