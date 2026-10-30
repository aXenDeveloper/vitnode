import { buildRoute } from "@/api/builders";
import {
  auditFilterOptions,
  zodAuditFilterOptions,
} from "@/api/lib/audit/registry";

export const activityLogFiltersAdminRoute = buildRoute({
  adminStaffPermission: { module: "activity_logs", permission: "can_view" },
  route: {
    method: "get",
    path: "/filters",
    description:
      "The plugins and declared actions the Activity Logs filters offer",
    responses: {
      200: {
        content: { "application/json": { schema: zodAuditFilterOptions } },
        description: "Filter options",
      },
    },
  },
  handler: c => c.json(auditFilterOptions(c.get("core")), 200),
});
