import { buildRoute } from "@/api/builders";
import {
  listAuditLogs,
  zodAuditListQuery,
  zodAuditPage,
} from "@/api/lib/audit/query";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const listActivityLogsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.activity_logs.canView,
  route: {
    method: "get",
    path: "/",
    description:
      "Activity Logs: who did what to which resource, newest first, paginated by page number and filtered",
    request: { query: zodAuditListQuery },
    responses: {
      200: {
        content: { "application/json": { schema: zodAuditPage } },
        description: "One page of audit entries",
      },
      400: { description: "Invalid filter or cursor" },
    },
  },
  handler: async c => {
    return c.json(await listAuditLogs(c, c.req.valid("query")), 200);
  },
});
