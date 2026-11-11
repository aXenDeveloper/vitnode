import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { reconcileNotifications } from "@/api/models/notifications/admin";

export const reconcileNotificationCountsRoute = buildRoute({
  adminStaffPermission: { module: "notifications", permission: "can_manage" },
  route: {
    method: "post",
    description:
      "Compare stored unread counts with the inbox and, unless dryRun, fix the ones that drifted.",
    path: "/reconcile",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              dryRun: z.boolean().default(true),
              userId: z.number().int().positive().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ corrected: z.number(), mismatched: z.number() }),
          },
        },
        description: "Reconciliation result",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: async c =>
    c.json(await reconcileNotifications(c, c.req.valid("json"))),
});
