import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { AUDIT_PERMISSIONS, canAdminAudit } from "@/api/lib/audit/access";
import { exportAuditLogs, zodAuditFilters } from "@/api/lib/audit/query";
import { writeAuditLog } from "@/api/lib/audit/write";
import { AUDIT_EXPORT_MAX_ROWS } from "@/lib/audit/const";
import { toCsv } from "@/lib/audit/csv";

export const exportActivityLogsAdminRoute = buildRoute({
  adminStaffPermission: { module: "activity_logs", permission: "can_export" },
  route: {
    method: "get",
    path: "/export",
    description: `Download the filtered Activity Logs as CSV, newest first, at most ${AUDIT_EXPORT_MAX_ROWS} rows. IP addresses only with can_view_sensitive`,
    request: { query: zodAuditFilters },
    responses: {
      200: {
        content: { "text/csv": { schema: z.string() } },
        description: "CSV file",
      },
    },
  },
  handler: async c => {
    const filters = c.req.valid("query");
    const sensitive = await canAdminAudit(c, AUDIT_PERMISSIONS.viewSensitive);
    const rows = await exportAuditLogs(c, {
      filters,
      limit: AUDIT_EXPORT_MAX_ROWS,
    });

    // An export is a copy of the history leaving the system, so it is part of
    // the history too.
    await writeAuditLog(c, {
      action: "audit_logs.exported",
      metadata: { filters, rows: rows.length },
      target: { id: "activity_logs", label: "Activity Logs", type: "settings" },
    });

    const csv = toCsv(
      [
        "id",
        "createdAt",
        "area",
        "pluginId",
        "action",
        "actorType",
        "actorId",
        "actorName",
        "targetType",
        "targetId",
        "targetLabel",
        "scope",
        "changes",
        ...(sensitive ? ["ipAddress"] : []),
      ],
      rows.map(row => [
        row.id,
        row.createdAt,
        row.area,
        row.pluginId,
        row.action,
        row.actorType,
        row.actorId,
        row.actorName,
        row.targetType,
        row.targetId,
        row.targetLabel,
        row.scopeFamily ? `${row.scopeFamily}:${row.scopeId ?? ""}` : null,
        row.changes,
        ...(sensitive ? [row.ipAddress] : []),
      ]),
    );
    const date = new Date().toISOString().slice(0, 10);

    return c.body(csv, 200, {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="activity-logs-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    });
  },
});
