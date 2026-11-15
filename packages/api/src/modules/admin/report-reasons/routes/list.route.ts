import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import {
  listReportReasons,
  reportReasonSchema,
} from "@/lib/moderation/report-reasons";
import { json } from "@/modules/moderation/moderation.schema";

export const listReportReasonsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.report_reasons.canView,
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
