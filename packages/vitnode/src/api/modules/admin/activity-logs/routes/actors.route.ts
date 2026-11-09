import { buildRoute } from "@/api/builders";
import {
  listAuditActors,
  zodAuditActors,
  zodAuditActorsQuery,
} from "@/api/lib/audit/query";

export const activityLogActorsAdminRoute = buildRoute({
  adminStaffPermission: { module: "activity_logs", permission: "can_view" },
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
