import { z } from "zod";

import { buildRoute } from "@/builders";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/lib/with-pagination";
import {
  listNotificationsTable,
  NOTIFICATION_TABLE_ORDER_BY,
} from "@/models/notifications/inbox";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  unauthorizedResponse,
  zodNotificationItem,
} from "../notifications.schema";

const CATEGORY = /^[a-z0-9_-]{1,50}$/;

export const inboxNotificationsRoute = buildRoute({
  route: {
    method: "get",
    description:
      "One numbered page of the signed-in user's notifications with totals, for the notifications table. Filter by read status and categories, sort by last activity or category. Listing never marks anything read.",
    path: "/inbox",
    request: {
      query: zodPaginationQuery.extend({
        category: z
          .string()
          .max(500)
          .refine(
            value => value.split(",").every(part => CATEGORY.test(part)),
            "Categories are comma-separated ids.",
          )
          .optional(),
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(NOTIFICATION_TABLE_ORDER_BY).optional(),
        status: z.enum(["read", "unread"]).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodNotificationItem),
              pageInfo: zodPaginationPageInfo,
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
    const { category, order, orderBy, status, ...query } = c.req.valid("query");

    return c.json(
      await listNotificationsTable(c, {
        categories: category ? [...new Set(category.split(","))] : [],
        language: user.language,
        order: order ?? "desc",
        orderBy: orderBy ?? "lastActivityAt",
        query,
        status,
        userId: user.id,
      }),
    );
  },
});
