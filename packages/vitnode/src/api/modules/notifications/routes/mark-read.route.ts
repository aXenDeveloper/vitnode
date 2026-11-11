import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { markNotificationRead } from "@/api/models/notifications/inbox";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  stateResponse,
  zodNotificationIdParams,
} from "../notifications.schema";

export const markNotificationReadRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Mark one notification read, up to the activity the user saw. Repeating it changes nothing.",
    path: "/{id}/read",
    request: {
      params: zodNotificationIdParams,
      body: {
        required: false,
        content: {
          "application/json": {
            schema: z.object({
              throughSeq: z.number().int().min(1).optional(),
            }),
          },
        },
      },
    },
    responses: stateResponse,
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { id } = c.req.valid("param");
    const body = c.req.header("content-type")?.includes("application/json")
      ? c.req.valid("json")
      : {};

    return c.json(
      await markNotificationRead(c, {
        notificationId: id,
        throughSeq: body.throughSeq,
        userId: user.id,
      }),
    );
  },
});
