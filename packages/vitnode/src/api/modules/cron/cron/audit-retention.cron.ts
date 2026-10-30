import { pruneAuditLogs } from "@/api/lib/audit/retention";
import { loadAuditSettings } from "@/api/lib/audit/settings";
import { writeAuditLog } from "@/api/lib/audit/write";
import { buildCron } from "@/api/lib/cron";

export const auditRetentionCron = buildCron({
  name: "audit-retention",
  description:
    "Delete Activity Logs entries older than the retention period set in the AdminCP",
  schedule: "40 3 * * *",
  handler: async c => {
    const { retentionDays } = await loadAuditSettings(c.get("db"));
    const deleted = await pruneAuditLogs(c.get("db"), { retentionDays });
    if (deleted === 0) return;

    // The one deletion the log ever sees, and it says so.
    await writeAuditLog(c, {
      action: "audit_logs.pruned",
      metadata: { deleted, retentionDays },
      target: { label: "Activity Logs", type: "settings", id: "activity_logs" },
    });
  },
});
