import { and, eq, getColumns, inArray } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import {
  serializeSubscription,
  zodSubscription,
} from "@/api/modules/payments/schema";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";
import { core_users } from "@/database/users";
import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "@/payments/status";

import {
  commaList,
  commonPaymentFilters,
  zodPaymentsAdminFilters,
} from "../filters";

const isStatus = (value: string): value is SubscriptionStatus =>
  (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);

export const listSubscriptionsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "payments", permission: "can_view" },
  route: {
    method: "get",
    description: "Every subscription, newest first.",
    path: "/subscriptions",
    request: {
      query: zodPaginationQuery.extend(zodPaymentsAdminFilters.shape).extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["createdAt", "paidThrough"]).optional(),
        status: z.string().max(200).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                zodSubscription.extend({
                  id: z.number(),
                  lastError: z.string().nullable(),
                  publicId: z.string(),
                  purchaseId: z.string(),
                  user: z
                    .object({ id: z.number(), name: z.string() })
                    .nullable(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "One page of subscriptions",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const statuses = commaList(query.status, isStatus);

    const page = await withPagination({
      c,
      orderBy: {
        column: core_payments_subscriptions[query.orderBy ?? "createdAt"],
        order: query.order ?? "desc",
      },
      params: { query },
      primaryCursor: core_payments_subscriptions.id,
      query: async ({ cursorSelection, limit, offset, orderBy, where }) =>
        await c
          .get("db")
          .select({
            ...getColumns(core_payments_subscriptions),
            ...cursorSelection,
            purchasePublicId: core_payments_purchases.publicId,
            userName: core_users.name,
          })
          .from(core_payments_subscriptions)
          .innerJoin(
            core_payments_purchases,
            eq(
              core_payments_purchases.id,
              core_payments_subscriptions.purchaseId,
            ),
          )
          .leftJoin(
            core_users,
            eq(core_users.id, core_payments_subscriptions.userId),
          )
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_payments_subscriptions,
      where: and(
        statuses.length
          ? inArray(core_payments_subscriptions.status, statuses)
          : undefined,
        commonPaymentFilters(query, core_payments_subscriptions),
      ),
    });

    return c.json({
      edges: page.edges.map(row => ({
        ...serializeSubscription(row),
        id: row.id,
        lastError: row.lastError,
        publicId: row.publicId,
        purchaseId: row.purchasePublicId,
        user:
          row.userId === null
            ? null
            : { id: row.userId, name: row.userName ?? "" },
      })),
      pageInfo: page.pageInfo,
    });
  },
});
