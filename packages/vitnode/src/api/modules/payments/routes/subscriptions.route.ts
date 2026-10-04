import { eq, getColumns } from "drizzle-orm";
import { z } from "zod";

import type { SubscriptionRow } from "@/api/models/payments/shared";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { requirePaymentsUser } from "@/api/models/payments/shared";
import { CONFIG_PLUGIN } from "@/config";
import { core_payments_subscriptions } from "@/database/payments";

import { privateResponse } from "../private-response";
import {
  paymentsErrorResponses,
  serializeSubscription,
  zodSubscription,
} from "../schema";

export const listSubscriptionsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "The signed-in user's subscriptions, newest first.",
    path: "/subscriptions",
    middleware: [privateResponse],
    request: { query: zodPaginationQuery },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodSubscription),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "One page of subscriptions",
      },
      401: paymentsErrorResponses[401],
    },
  },
  handler: async c => {
    const user = requirePaymentsUser(c);
    const page = await withPagination({
      c,
      orderBy: { column: core_payments_subscriptions.createdAt, order: "desc" },
      params: { query: c.req.valid("query") },
      primaryCursor: core_payments_subscriptions.id,
      query: async ({ cursorSelection, limit, offset, orderBy, where }) =>
        await c
          .get("db")
          .select({
            ...getColumns(core_payments_subscriptions),
            ...cursorSelection,
          })
          .from(core_payments_subscriptions)
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_payments_subscriptions,
      where: eq(core_payments_subscriptions.userId, user.id),
    });

    return c.json({
      edges: page.edges.map(row =>
        serializeSubscription(row as SubscriptionRow),
      ),
      pageInfo: page.pageInfo,
    });
  },
});
