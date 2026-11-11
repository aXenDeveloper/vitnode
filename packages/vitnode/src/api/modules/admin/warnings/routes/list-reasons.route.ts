import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import {
  listWarningReasons,
  warningReasonSchema,
} from "@/api/lib/moderation/warnings/reasons";
import { json } from "@/api/modules/moderation/moderation.schema";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const listWarningReasonsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.warning_settings.canView,
  route: {
    method: "get",
    path: "/reasons",
    description:
      "Every warning reason in display order, disabled ones too (Admin only)",
    responses: {
      200: json(
        z.object({ reasons: z.array(warningReasonSchema) }),
        "Warning reasons",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => c.json({ reasons: await listWarningReasons(c) }, 200),
});
