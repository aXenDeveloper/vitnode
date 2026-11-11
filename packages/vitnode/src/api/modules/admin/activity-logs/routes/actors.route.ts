import { buildRoute } from "@/api/builders";
import {
  listAuditActors,
  zodAuditActors,
  zodAuditActorsQuery,
} from "@/api/lib/audit/query";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const activityLogActorsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.activity_logs.canView,
  route: {
    method: "get",
    path: "/actors",
    description:
      "The accounts that acted in a staff log, by current name, for the actor filter",
    request: { query: zodAuditActorsQuery },
    responses: {
      200: {
        content: { "application/json": { schema: zodAuditActors } },
        description: "Up to 20 actors",
      },
    },
  },
  handler: async c =>
    c.json(await listAuditActors(c, c.req.valid("query")), 200),
});
