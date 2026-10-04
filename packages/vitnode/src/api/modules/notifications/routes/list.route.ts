import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { listNotifications } from "@/api/models/notifications/inbox";
import { CONFIG_PLUGIN } from "@/config";

import {
  requireNotificationUser,
  unauthorizedResponse,
  zodNotificationItem,
} from "../schema";

export const listNotificationsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "List the signed-in user's notifications, newest activity first. Listing never marks anything read.",
    path: "/",
    request: {
      query: z.object({
        category: z.string().max(50).optional(),
        cursor: z.string().max(200).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        type: z.string().max(100).optional(),
        unread: z.enum(["true", "false"]).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(zodNotificationItem),
              nextCursor: z.string().nullable(),
            }),
          },
        },
        description: "One page of notifications",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { category, cursor, limit, type, unread } = c.req.valid("query");

    return c.json(
      await listNotifications(c, {
        category,
        cursor,
        language: user.language,
        limit,
        type,
        unreadOnly: unread === "true",
        userId: user.id,
      }),
    );
  },
});
