import type { Context } from "hono";

import type { ContentDatabase } from "@/content/server/service";
import type { AuditChanges } from "@/lib/audit/const";

import { withAuditContext } from "@/api/lib/audit/context";
import { writeAuditLog } from "@/api/lib/audit/write";

import type { ReportRow } from "./reports";

type AuditedReport = Pick<
  ReportRow,
  | "id"
  | "pluginId"
  | "scopeFamily"
  | "scopeId"
  | "targetId"
  | "targetTitle"
  | "targetType"
>;

const scopeOf = (report: AuditedReport) =>
  report.scopeFamily && report.scopeId
    ? { family: report.scopeFamily, id: report.scopeId }
    : null;

/**
 * Runs one moderator operation on a report: every audit entry written inside -
 * the report's own and any its action causes, such as hiding the reported
 * post - is attributed to the ModeratorCP and to the report's moderation
 * scope, so a moderator of that scope (and only of that scope) sees it.
 */
export const withReportAudit = async <TResult>(
  c: Context,
  report: AuditedReport,
  body: () => Promise<TResult>,
): Promise<TResult> =>
  await withAuditContext(
    c,
    {
      area: "moderator",
      metadata: { reportId: report.id },
      scope: scopeOf(report),
    },
    body,
  );

/**
 * The global audit entry of a report workflow step, written in the same
 * transaction as the report update and its own timeline event. The report's
 * timeline (`core_moderation_report_events`) stays the detailed history; this
 * entry is what a cross-plugin activity view lists.
 */
export const recordReportAudit = async (
  c: Context,
  tx: ContentDatabase,
  report: AuditedReport,
  {
    action,
    changes = null,
    metadata,
  }: {
    action: string;
    changes?: AuditChanges | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  await writeAuditLog(
    c,
    {
      action: `report.${action}`,
      area: "moderator",
      changes,
      metadata: {
        reportedPluginId: report.pluginId,
        reportedTargetId: report.targetId,
        reportedTargetType: report.targetType,
        ...metadata,
      },
      scope: scopeOf(report),
      target: {
        id: report.id,
        label: report.targetTitle
          ? `#${report.id} ${report.targetTitle}`
          : `#${report.id}`,
        type: "report",
      },
    },
    tx,
  );
};
