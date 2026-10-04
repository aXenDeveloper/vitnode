import { and, desc, eq, getColumns, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import {
  serializePurchase,
  serializeSubscription,
  zodPurchase,
  zodSubscription,
} from "@/api/modules/payments/schema";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_payments_adjustments,
  core_payments_checkouts,
  core_payments_fulfillments,
  core_payments_invoices,
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";
import { core_users } from "@/database/users";
import {
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
  PURCHASE_PAYMENT_STATUSES,
  type PurchasePaymentStatus,
} from "@/payments/status";

import {
  commaList,
  commonPaymentFilters,
  zodPaymentsAdminFilters,
} from "../filters";

const zodAdminPurchase = zodPurchase.extend({
  /** Internal row id - AdminCP tables key rows by it. */
  id: z.number(),
  lastError: z.string().nullable(),
  publicId: z.string(),
  providerScope: z.string(),
  user: z.object({ id: z.number(), name: z.string() }).nullable(),
});

const isPaymentStatus = (value: string): value is PurchasePaymentStatus =>
  (PURCHASE_PAYMENT_STATUSES as readonly string[]).includes(value);
const isFulfillmentStatus = (value: string): value is FulfillmentStatus =>
  (FULFILLMENT_STATUSES as readonly string[]).includes(value);

export const listPurchasesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "payments", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Every purchase, newest first, with payment and fulfillment state.",
    path: "/purchases",
    request: {
      query: zodPaginationQuery.extend(zodPaymentsAdminFilters.shape).extend({
        fulfillment: z.string().max(200).optional(),
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["createdAt", "amount"]).optional(),
        status: z.string().max(200).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodAdminPurchase),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "One page of purchases",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const statuses = commaList(query.status, isPaymentStatus);
    const fulfillment = commaList(query.fulfillment, isFulfillmentStatus);

    const page = await withPagination({
      c,
      orderBy: {
        column: core_payments_purchases[query.orderBy ?? "createdAt"],
        order: query.order ?? "desc",
      },
      params: { query },
      primaryCursor: core_payments_purchases.id,
      query: async ({ cursorSelection, limit, offset, orderBy, where }) =>
        await c
          .get("db")
          .select({
            ...getColumns(core_payments_purchases),
            ...cursorSelection,
            userName: core_users.name,
          })
          .from(core_payments_purchases)
          .leftJoin(
            core_users,
            eq(core_users.id, core_payments_purchases.userId),
          )
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_payments_purchases,
      where: and(
        statuses.length
          ? inArray(core_payments_purchases.paymentStatus, statuses)
          : undefined,
        fulfillment.length
          ? inArray(core_payments_purchases.fulfillmentStatus, fulfillment)
          : undefined,
        commonPaymentFilters(query, core_payments_purchases),
      ),
    });

    return c.json({
      edges: page.edges.map(row => ({
        ...serializePurchase(row),
        id: row.id,
        lastError: row.lastError,
        publicId: row.publicId,
        providerScope: row.providerScope,
        user:
          row.userId === null
            ? null
            : { id: row.userId, name: row.userName ?? "" },
      })),
      pageInfo: page.pageInfo,
    });
  },
});

export const showPurchaseAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "payments", permission: "can_view" },
  route: {
    method: "get",
    description:
      "One purchase with its checkout attempts, fulfillment work, refunds, disputes and - for a subscription - its billing history. Provider references only, never payloads.",
    path: "/purchases/{id}",
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              adjustments: z.array(
                z.object({
                  amount: z.number(),
                  createdAt: z.date(),
                  currency: z.string(),
                  externalId: z.string(),
                  invoiceId: z.number().nullable(),
                  kind: z.enum(["refund", "dispute"]),
                  reason: z.string().nullable(),
                  status: z.string(),
                }),
              ),
              checkouts: z.array(
                z.object({
                  createdAt: z.date(),
                  expiresAt: z.date(),
                  externalId: z.string().nullable(),
                  lastError: z.string().nullable(),
                  status: z.string(),
                }),
              ),
              externalCustomerId: z.string().nullable(),
              externalPaymentId: z.string().nullable(),
              fulfillments: z.array(
                z.object({
                  attempts: z.number(),
                  completedAt: z.date().nullable(),
                  effect: z.string(),
                  id: z.number(),
                  lastError: z.string().nullable(),
                  retryable: z.boolean(),
                  status: z.string(),
                  updatedAt: z.date(),
                }),
              ),
              invoices: z.array(
                z.object({
                  amountDue: z.number(),
                  amountPaid: z.number(),
                  billingReason: z.string().nullable(),
                  createdAt: z.date(),
                  currency: z.string(),
                  disputeStatus: z.string().nullable(),
                  externalId: z.string(),
                  id: z.number(),
                  paidAt: z.date().nullable(),
                  periodEnd: z.date().nullable(),
                  periodStart: z.date().nullable(),
                  refundedAmount: z.number(),
                  status: z.string(),
                }),
              ),
              offerRegistered: z.boolean(),
              purchase: zodAdminPurchase,
              subscription: zodSubscription
                .extend({
                  externalId: z.string(),
                  lastError: z.string().nullable(),
                  providerStatus: z.string(),
                  syncedAt: z.date(),
                })
                .nullable(),
            }),
          },
        },
        description: "Purchase detail",
      },
      404: { description: "No such purchase" },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const [row] = await db
      .select({
        ...getColumns(core_payments_purchases),
        userName: core_users.name,
      })
      .from(core_payments_purchases)
      .leftJoin(core_users, eq(core_users.id, core_payments_purchases.userId))
      .where(eq(core_payments_purchases.publicId, c.req.valid("param").id));

    if (!row) throw new HTTPException(404, { message: "Purchase not found." });

    const [checkouts, fulfillments, subscription] = await Promise.all([
      db
        .select()
        .from(core_payments_checkouts)
        .where(eq(core_payments_checkouts.purchaseId, row.id))
        .orderBy(desc(core_payments_checkouts.id)),
      db
        .select()
        .from(core_payments_fulfillments)
        .where(eq(core_payments_fulfillments.purchaseId, row.id))
        .orderBy(desc(core_payments_fulfillments.id)),
      db
        .select()
        .from(core_payments_subscriptions)
        .where(eq(core_payments_subscriptions.purchaseId, row.id))
        .then(rows => rows.at(0)),
    ]);

    const invoices = subscription
      ? await db
          .select()
          .from(core_payments_invoices)
          .where(eq(core_payments_invoices.subscriptionId, subscription.id))
          .orderBy(desc(core_payments_invoices.createdAt))
      : [];

    const invoiceIds = invoices.map(invoice => invoice.id);
    const adjustments = await db
      .select()
      .from(core_payments_adjustments)
      .where(
        invoiceIds.length
          ? inArray(core_payments_adjustments.invoiceId, invoiceIds)
          : eq(core_payments_adjustments.purchaseId, row.id),
      )
      .orderBy(desc(core_payments_adjustments.createdAt));

    return c.json({
      adjustments: adjustments.map(adjustment => ({
        amount: adjustment.amount,
        createdAt: adjustment.createdAt,
        currency: adjustment.currency,
        externalId: adjustment.externalId,
        invoiceId: adjustment.invoiceId,
        kind: adjustment.kind,
        reason: adjustment.reason,
        status: adjustment.status,
      })),
      checkouts: checkouts.map(checkout => ({
        createdAt: checkout.createdAt,
        expiresAt: checkout.expiresAt,
        externalId: checkout.externalId,
        lastError: checkout.lastError,
        status: checkout.status,
      })),
      externalCustomerId: row.externalCustomerId,
      externalPaymentId: row.externalPaymentId,
      fulfillments: fulfillments.map(fulfillment => ({
        attempts: fulfillment.attempts,
        completedAt: fulfillment.completedAt,
        effect: fulfillment.effect,
        id: fulfillment.id,
        lastError: fulfillment.lastError,
        retryable: fulfillment.completedGeneration < fulfillment.generation,
        status: fulfillment.status,
        updatedAt: fulfillment.updatedAt,
      })),
      invoices: invoices.map(invoice => ({
        amountDue: invoice.amountDue,
        amountPaid: invoice.amountPaid,
        billingReason: invoice.billingReason,
        createdAt: invoice.createdAt,
        currency: invoice.currency,
        disputeStatus: invoice.disputeStatus,
        externalId: invoice.externalId,
        id: invoice.id,
        paidAt: invoice.paidAt,
        periodEnd: invoice.periodEnd,
        periodStart: invoice.periodStart,
        refundedAmount: invoice.refundedAmount,
        status: invoice.status,
      })),
      offerRegistered: c
        .get("core")
        .payments.offers.has(`${row.pluginId}:${row.offerId}`),
      purchase: {
        ...serializePurchase(row),
        id: row.id,
        lastError: row.lastError,
        publicId: row.publicId,
        providerScope: row.providerScope,
        user:
          row.userId === null
            ? null
            : { id: row.userId, name: row.userName ?? "" },
      },
      subscription: subscription
        ? {
            ...serializeSubscription(subscription),
            externalId: subscription.externalId,
            lastError: subscription.lastError,
            providerStatus: subscription.providerStatus,
            syncedAt: subscription.syncedAt,
          }
        : null,
    });
  },
});
