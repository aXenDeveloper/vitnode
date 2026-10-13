import type { Context } from "hono";

import { and, count, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { ModeratorContext } from "@/api/lib/moderation/access";
import type { RegisteredReportTarget } from "@/api/lib/moderation/targets";
import type { ContentDatabase } from "@/content/server/service";
import type { ModerationReportEventType } from "@/lib/moderation/const";

import {
  canOnReport,
  syncReportTargetScope,
} from "@/api/lib/moderation/access";
import { findReportTarget } from "@/api/lib/moderation/registry";
import {
  core_moderation_report_events,
  core_moderation_reports,
} from "@/database/moderation";
import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

export type ReportRow = typeof core_moderation_reports.$inferSelect;

export const reportOpenKey = ({
  pluginId,
  reporterId,
  targetId,
  targetType,
}: {
  pluginId: string;
  reporterId: number;
  targetId: string;
  targetType: string;
}): string => `${reporterId}:${pluginId}:${targetType}:${targetId}`;

const jsonError = (
  status: 400 | 403 | 404 | 409 | 429,
  body: Record<string, unknown>,
): HTTPException =>
  new HTTPException(status, {
    message: String(body.error),
    res: Response.json(body, { status }),
  });

export const reportNotFound = (): HTTPException =>
  jsonError(404, { error: "not_found" });

export const reportConflict = (
  current: null | Pick<ReportRow, "assigneeId" | "status" | "version">,
  error = "conflict",
): HTTPException =>
  jsonError(409, {
    current: current
      ? {
          assigneeId: current.assigneeId,
          status: current.status,
          version: current.version,
        }
      : null,
    error,
  });

export const reportError = jsonError;

export const loadReport = async (
  db: ContentDatabase,
  id: number,
): Promise<null | ReportRow> => {
  const [row] = await db
    .select()
    .from(core_moderation_reports)
    .where(eq(core_moderation_reports.id, id))
    .limit(1);

  return row ?? null;
};

export const updateReport = async (
  db: ContentDatabase,
  report: Pick<ReportRow, "id" | "version">,
  patch: Partial<
    Omit<typeof core_moderation_reports.$inferInsert, "id" | "version">
  >,
): Promise<ReportRow> => {
  const [updated] = await db
    .update(core_moderation_reports)
    .set({ ...patch, version: report.version + 1 })
    .where(
      and(
        eq(core_moderation_reports.id, report.id),
        eq(core_moderation_reports.version, report.version),
      ),
    )
    .returning();
  if (updated) return updated;

  throw reportConflict(await loadReport(db, report.id));
};

export const appendReportEvent = async (
  db: ContentDatabase,
  event: {
    actorId: null | number;
    data?: Record<string, unknown>;
    reportId: number;
    type: ModerationReportEventType;
  },
): Promise<void> => {
  await db.insert(core_moderation_report_events).values({
    actorId: event.actorId,
    data: event.data ?? {},
    reportId: event.reportId,
    type: event.type,
  });
};

export interface AuthorizedReport {
  report: ReportRow;
  scopeId: null | string;
  target: RegisteredReportTarget | undefined;
}

export const authorizeReport = async (
  c: Context,
  moderator: ModeratorContext,
  id: number,
  { manage = false }: { manage?: boolean } = {},
): Promise<AuthorizedReport> => {
  const db = c.get("db");
  let report = await loadReport(db, id);
  if (!report) throw reportNotFound();

  const target = findReportTarget(c.get("core").moderation, {
    pluginId: report.pluginId,
    type: report.targetType,
  });

  if (target?.definition.scope) {
    const current = await syncReportTargetScope(c, {
      target,
      targetId: report.targetId,
    });
    if (current !== undefined && current !== report.scopeId) {
      report = (await loadReport(db, id)) ?? report;
    }
  }

  const ref = {
    pluginId: report.pluginId,
    scopeId: report.scopeId,
    targetType: report.targetType,
  };
  if (!canOnReport(c, moderator.set, ref, MODERATION_PERMISSIONS.viewReports)) {
    throw reportNotFound();
  }
  if (
    manage &&
    !canOnReport(c, moderator.set, ref, MODERATION_PERMISSIONS.manageReports)
  ) {
    throw reportError(403, { error: "forbidden" });
  }

  return { report, scopeId: report.scopeId, target };
};

export const countRecentReports = async (
  c: Context,
  reporterId: number,
): Promise<number> => {
  const [row] = await c
    .get("db")
    .select({ value: count() })
    .from(core_moderation_reports)
    .where(
      and(
        eq(core_moderation_reports.reporterId, reporterId),
        gte(
          core_moderation_reports.createdAt,
          new Date(Date.now() - 60 * 60 * 1000),
        ),
      ),
    );

  return row?.value ?? 0;
};

export const relatedReports = async (
  c: Context,
  moderator: ModeratorContext,
  report: ReportRow,
) => {
  const rows = await c
    .get("db")
    .select({
      createdAt: core_moderation_reports.createdAt,
      description: core_moderation_reports.description,
      id: core_moderation_reports.id,
      reason: core_moderation_reports.reason,
      reporterId: core_moderation_reports.reporterId,
      scopeId: core_moderation_reports.scopeId,
      status: core_moderation_reports.status,
    })
    .from(core_moderation_reports)
    .where(
      and(
        eq(core_moderation_reports.pluginId, report.pluginId),
        eq(core_moderation_reports.targetType, report.targetType),
        eq(core_moderation_reports.targetId, report.targetId),
      ),
    )
    .orderBy(desc(core_moderation_reports.createdAt))
    .limit(50);

  return rows
    .filter(row => row.id !== report.id)
    .filter(row =>
      canOnReport(
        c,
        moderator.set,
        {
          pluginId: report.pluginId,
          scopeId: row.scopeId,
          targetType: report.targetType,
        },
        MODERATION_PERMISSIONS.viewReports,
      ),
    )
    .map(({ scopeId: _scope, ...row }) => row);
};

export const queueFilters = ({
  assigned,
  status,
  userId,
}: {
  assigned: "any" | "me" | "unassigned";
  status: "all" | "done" | "in_progress" | "new" | "open";
  userId: number;
}) => {
  const table = core_moderation_reports;
  const byStatus =
    status === "all"
      ? undefined
      : status === "open"
        ? or(eq(table.status, "new"), eq(table.status, "in_progress"))
        : eq(table.status, status);
  const byAssignee =
    assigned === "me"
      ? eq(table.assigneeId, userId)
      : assigned === "unassigned"
        ? isNull(table.assigneeId)
        : undefined;

  return [byStatus, byAssignee].filter(condition => condition !== undefined);
};

export const reportTargetTriplets = (
  rows: Pick<ReportRow, "pluginId" | "targetId" | "targetType">[],
) =>
  or(
    ...rows.map(row =>
      and(
        eq(core_moderation_reports.pluginId, row.pluginId),
        eq(core_moderation_reports.targetType, row.targetType),
        eq(core_moderation_reports.targetId, row.targetId),
      ),
    ),
  );

export const reportIdsOf = (ids: number[]) =>
  inArray(core_moderation_reports.id, ids);
