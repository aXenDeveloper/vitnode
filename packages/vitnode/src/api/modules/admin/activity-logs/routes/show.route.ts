import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { AUDIT_PERMISSIONS, canAdminAudit } from "@/api/lib/audit/access";
import { auditDetailOf } from "@/api/lib/audit/detail";
import { findAuditLog, zodAuditDetail } from "@/api/lib/audit/query";

export const activityLogDetailAdminRoute = buildRoute({
  adminStaffPermission: { module: "activity_logs", permission: "can_view" },
  route: {
    method: "get",
    path: "/{id}",
    description:
      "One Activity Logs entry with its changes, metadata and the content revision it points at",
    request: {
      params: z.object({
        id: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodAuditDetail } },
        description: "The entry",
      },
      404: { description: "No such entry" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const entry = await findAuditLog(c, id);
    if (!entry) return c.json({ error: "Not found" }, 404);

    return c.json(
      await auditDetailOf(c, entry, {
        canViewSensitive: await canAdminAudit(
          c,
          AUDIT_PERMISSIONS.viewSensitive,
        ),
      }),
      200,
    );
  },
});
