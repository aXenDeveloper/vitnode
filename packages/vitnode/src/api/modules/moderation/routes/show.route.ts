import { z } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";

import { canOnReport, requireModerator } from "@/api/lib/moderation/access";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_moderation_report_events } from "@/database/moderation";
import {
  MODERATION_PERMISSIONS,
  MODERATION_REPORT_STATUSES,
  MODERATION_TARGET_ACTIONS,
} from "@/lib/moderation/const";

import { canChangeNote } from "../lib/notes";
import { loadReportPeople } from "../lib/people";
import { authorizeReport, relatedReports } from "../lib/reports";
import {
  errorSchema,
  eventTypeSchema,
  json,
  reasonSchema,
  reportIdParams,
  reportPersonSchema,
  resolutionSchema,
} from "../lib/schema";

const detailSchema = z.object({
  report: z.object({
    id: z.number(),
    pluginId: z.string(),
    targetType: z.string(),
    targetId: z.string(),
    reason: reasonSchema,
    description: z.string().nullable(),
    status: z.enum(MODERATION_REPORT_STATUSES),
    resolution: resolutionSchema.nullable(),
    resolutionNote: z.string().nullable(),
    resolvedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    version: z.number(),
    scope: z.object({ family: z.string(), id: z.string() }).nullable(),
  }),
  targetLabel: z.string().nullable(),
  pluginLabel: z.string(),
  snapshot: z.object({}).loose(),
  authors: z.array(reportPersonSchema),
  reporter: reportPersonSchema.nullable(),
  assignee: reportPersonSchema.nullable(),
  events: z.array(
    z.object({
      id: z.number(),
      type: eventTypeSchema,
      actor: reportPersonSchema.nullable(),
      data: z.record(z.string(), z.unknown()),
      canEdit: z.boolean(),
      canDelete: z.boolean(),
      createdAt: z.date(),
    }),
  ),
  related: z.array(
    z.object({
      id: z.number(),
      status: z.enum(MODERATION_REPORT_STATUSES),
      reason: reasonSchema,
      description: z.string().nullable(),
      authors: z.array(reportPersonSchema),
      reporter: reportPersonSchema.nullable(),
      createdAt: z.date(),
    }),
  ),
  current: z.object({
    exists: z.boolean(),
    hidden: z.boolean(),
    url: z.string().nullable(),
    registered: z.boolean(),
  }),
  permissions: z.object({
    manage: z.boolean(),
    actions: z.array(
      z.object({
        action: z.enum(MODERATION_TARGET_ACTIONS),
        allowed: z.boolean(),
        available: z.boolean(),
      }),
    ),
  }),
});

export const showReportRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/reports/{id}",
    description:
      "One report with its snapshot, timeline and the related reports the moderator may see",
    request: { params: reportIdParams },
    responses: {
      200: json(detailSchema, "The report"),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
      404: json(
        errorSchema,
        "No such report, or not one this moderator may see",
      ),
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { report, target } = await authorizeReport(c, moderator, id);
    const db = c.get("db");

    const [events, related] = await Promise.all([
      db
        .select({
          actorId: core_moderation_report_events.actorId,
          createdAt: core_moderation_report_events.createdAt,
          data: core_moderation_report_events.data,
          id: core_moderation_report_events.id,
          type: core_moderation_report_events.type,
        })
        .from(core_moderation_report_events)
        .where(eq(core_moderation_report_events.reportId, report.id))
        .orderBy(asc(core_moderation_report_events.id)),
      relatedReports(c, moderator, report),
    ]);
    const authorIds = Array.isArray(report.snapshot.authors)
      ? report.snapshot.authors.flatMap(author =>
          typeof author.id === "number" ? [author.id] : [],
        )
      : [];
    const people = await loadReportPeople(c, [
      ...authorIds,
      report.reporterId,
      report.assigneeId,
      ...events.map(event => event.actorId),
      ...related.map(entry => entry.reporterId),
    ]);
    const userOf = (userId: null | number) =>
      userId === null ? null : (people.get(userId) ?? null);

    const locale =
      typeof report.snapshot.locale?.served === "string"
        ? report.snapshot.locale.served
        : null;
    const current = target
      ? await target.definition.current(c, {
          locale,
          targetId: report.targetId,
        })
      : null;

    const ref = {
      pluginId: report.pluginId,
      scopeId: report.scopeId,
      targetType: report.targetType,
    };
    const manage = canOnReport(
      c,
      moderator.set,
      ref,
      MODERATION_PERMISSIONS.manageReports,
    );

    return c.json(
      {
        report: {
          id: report.id,
          pluginId: report.pluginId,
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          description: report.description,
          status: report.status,
          resolution: report.resolution,
          resolutionNote: report.resolutionNote,
          resolvedAt: report.resolvedAt,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          version: report.version,
          scope:
            report.scopeFamily && report.scopeId
              ? { family: report.scopeFamily, id: report.scopeId }
              : null,
        },
        targetLabel: target?.definition.label ?? null,
        pluginLabel: `${report.pluginId}.title`,
        snapshot: { ...report.snapshot },
        authors: authorIds.flatMap(authorId => {
          const person = people.get(authorId);

          return person ? [person] : [];
        }),
        reporter: userOf(report.reporterId),
        assignee: userOf(report.assigneeId),
        events: events.map(event => ({
          id: event.id,
          type: event.type,
          actor: userOf(event.actorId),
          data: event.data,
          canEdit:
            event.type === "note" &&
            canChangeNote(c, moderator, report, event, "edit"),
          canDelete:
            event.type === "note" &&
            canChangeNote(c, moderator, report, event, "delete"),
          createdAt: event.createdAt,
        })),
        related: related.map(({ reporterId, ...entry }) => ({
          ...entry,
          reporter: userOf(reporterId),
        })),
        current: {
          exists: current !== null,
          hidden: current?.hidden ?? false,
          url: current?.url ?? null,
          registered: target !== undefined,
        },
        permissions: {
          manage,
          actions: MODERATION_TARGET_ACTIONS.flatMap(action => {
            const definition = target?.definition.actions?.[action];
            if (!definition) return [];

            return [
              {
                action,
                allowed:
                  manage &&
                  canOnReport(c, moderator.set, ref, definition.permission),
                available: current !== null && definition.available(current),
              },
            ];
          }),
        },
      },
      200,
    );
  },
});
