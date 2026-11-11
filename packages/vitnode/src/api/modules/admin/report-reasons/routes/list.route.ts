import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import {
  listReportReasons,
  reportReasonSchema,
} from "@/api/lib/moderation/report-reasons";
import { json } from "@/api/modules/moderation/moderation.schema";

export const listReportReasonsAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_view" },
  route: {
    method: "get",
    path: "/",
    description: "Every report reason in display order (Admin only)",
    responses: {
      200: json(
        z.object({ reasons: z.array(reportReasonSchema) }),
        "Report reasons",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => c.json({ reasons: await listReportReasons(c) }, 200),
});
