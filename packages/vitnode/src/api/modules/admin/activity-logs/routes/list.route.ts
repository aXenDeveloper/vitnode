import { buildRoute } from "@/api/builders";
import {
  listAuditLogs,
  zodAuditPage,
  zodAuditPageQuery,
} from "@/api/lib/audit/query";

export const listActivityLogsAdminRoute = buildRoute({
  adminStaffPermission: { module: "activity_logs", permission: "can_view" },
  route: {
    method: "get",
    path: "/",
    description:
      "Activity Logs: who did what to which resource, newest first, cursor-paginated and filtered",
    request: { query: zodAuditPageQuery },
    responses: {
      200: {
        content: { "application/json": { schema: zodAuditPage } },
        description: "One page of audit entries",
      },
      400: { description: "Invalid filter or cursor" },
    },
  },
  handler: async c => {
    const { cursor, first, ...filters } = c.req.valid("query");

    return c.json(await listAuditLogs(c, { cursor, filters, first }), 200);
  },
});
