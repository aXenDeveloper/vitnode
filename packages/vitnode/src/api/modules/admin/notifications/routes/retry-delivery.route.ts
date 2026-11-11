import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { retryNotificationDelivery } from "@/api/models/notifications/admin";

export const retryNotificationDeliveryRoute = buildRoute({
  adminStaffPermission: { module: "notifications", permission: "can_manage" },
  route: {
    method: "post",
    description:
      "Retry a failed email delivery with the same idempotency key and the same notifications.",
    path: "/deliveries/{id}/retry",
    request: { params: z.object({ id: z.coerce.number().int().positive() }) },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
        description: "Queued for retry",
      },
      403: { description: "Access Denied" },
      409: { description: "The delivery has not failed" },
    },
  },
  handler: async c => {
    await retryNotificationDelivery(c, c.req.valid("param").id);

    return c.json({ success: true });
  },
});
