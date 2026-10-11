import { and, eq, getColumns, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import type {
  PaymentsContext,
  PurchaseRow,
} from "@/api/models/payments/shared";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { cancelPurchase } from "@/api/models/payments/checkout";
import {
  describePaymentsError,
  paymentsHttpError,
  providerForRow,
  requirePaymentsUser,
} from "@/api/models/payments/shared";
import { refreshPurchase } from "@/api/models/payments/sync";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_payments_checkouts,
  core_payments_purchases,
} from "@/database/payments";

import { privateResponse } from "../private-response";
import {
  paymentsErrorResponses,
  serializePurchase,
  zodPublicId,
  zodPurchase,
} from "../schema";

/** How often one purchase may trigger a provider read from the browser. */
const REFRESH_THROTTLE_SECONDS = 5;

// An atomic row claim, so the throttle holds across instances without Redis.
const claimRefresh = async (
  c: PaymentsContext,
  purchaseId: number,
): Promise<boolean> => {
  const [claimed] = await c
    .get("db")
    .update(core_payments_purchases)
    .set({ refreshCheckedAt: new Date() })
    .where(
      and(
        eq(core_payments_purchases.id, purchaseId),
        or(
          isNull(core_payments_purchases.refreshCheckedAt),
          lt(
            core_payments_purchases.refreshCheckedAt,
            new Date(Date.now() - REFRESH_THROTTLE_SECONDS * 1000),
          ),
        ),
      ),
    )
    .returning({ id: core_payments_purchases.id });

  return !!claimed;
};

/**
 * The purchase only if the signed-in user owns it. Not owning it reads exactly
 * like it not existing - an opaque id is never authorization by itself.
 */
export const findOwnPurchase = async (
  c: PaymentsContext,
  publicId: string,
): Promise<PurchaseRow> => {
  const user = requirePaymentsUser(c);
  const [purchase] = await c
    .get("db")
    .select()
    .from(core_payments_purchases)
    .where(
      and(
        eq(core_payments_purchases.publicId, publicId),
        eq(core_payments_purchases.userId, user.id),
      ),
    );

  if (!purchase) {
    throw paymentsHttpError(404, "purchase_not_found", "Purchase not found.");
  }

  return purchase;
};

const openCheckoutUrl = async (
  c: PaymentsContext,
  purchase: PurchaseRow,
): Promise<null | string> => {
  if (purchase.paymentStatus !== "awaiting_payment") return null;

  const [checkout] = await c
    .get("db")
    .select({
      expiresAt: core_payments_checkouts.expiresAt,
      url: core_payments_checkouts.url,
    })
    .from(core_payments_checkouts)
    .where(
      and(
        eq(core_payments_checkouts.purchaseId, purchase.id),
        eq(core_payments_checkouts.status, "open"),
      ),
    );

  return checkout && checkout.expiresAt > new Date() ? checkout.url : null;
};

export const listPurchasesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "The signed-in user's purchases, newest first.",
    path: "/purchases",
    middleware: [privateResponse],
    request: { query: zodPaginationQuery },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodPurchase),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "One page of purchases",
      },
      401: paymentsErrorResponses[401],
    },
  },
  handler: async c => {
    const user = requirePaymentsUser(c);
    const page = await withPagination({
      c,
      orderBy: { column: core_payments_purchases.createdAt, order: "desc" },
      params: { query: c.req.valid("query") },
      primaryCursor: core_payments_purchases.id,
      query: async ({ cursorSelection, limit, offset, orderBy, where }) =>
        await c
          .get("db")
          .select({
            ...getColumns(core_payments_purchases),
            ...cursorSelection,
          })
          .from(core_payments_purchases)
          .where(where)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      table: core_payments_purchases,
      where: eq(core_payments_purchases.userId, user.id),
    });

    return c.json({
      edges: page.edges.map(row => serializePurchase(row as PurchaseRow)),
      pageInfo: page.pageInfo,
    });
  },
});

export const showPurchaseRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "One of the signed-in user's purchases. With `refresh=true`, an unfinished purchase is first checked with the provider - which is how the page the buyer returns to learns the outcome before the webhook is processed.",
    path: "/purchases/{id}",
    middleware: [privateResponse],
    request: {
      params: zodPublicId,
      query: z.object({ refresh: z.enum(["true", "false"]).optional() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              checkoutUrl: z.string().nullable(),
              purchase: zodPurchase,
            }),
          },
        },
        description: "The purchase as it stands",
      },
      401: paymentsErrorResponses[401],
      404: paymentsErrorResponses[404],
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    let purchase = await findOwnPurchase(c, id);

    if (
      c.req.valid("query").refresh === "true" &&
      (purchase.paymentStatus === "awaiting_payment" ||
        purchase.paymentStatus === "processing") &&
      c.get("core").payments.config &&
      (await claimRefresh(c, purchase.id))
    ) {
      try {
        purchase = await refreshPurchase(
          c,
          providerForRow(c, purchase),
          purchase,
        );
      } catch (error) {
        // The webhook and reconciliation still cover it; the buyer just sees
        // the last known state.
        await c
          .get("log")
          .warn(
            `[Payments] Refresh of ${purchase.publicId} failed: ${describePaymentsError(error)}`,
          );
      }
    }

    return c.json({
      checkoutUrl: await openCheckoutUrl(c, purchase),
      purchase: serializePurchase(purchase),
    });
  },
});

export const cancelPurchaseRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Cancel the signed-in user's unfinished checkout, so a new one can be started.",
    path: "/purchases/{id}/cancel",
    middleware: [privateResponse],
    request: { params: zodPublicId },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ purchase: zodPurchase }) },
        },
        description:
          "The purchase after cancelling - paid wins if it already was",
      },
      401: paymentsErrorResponses[401],
      404: paymentsErrorResponses[404],
      409: paymentsErrorResponses[409],
    },
  },
  handler: async c => {
    const purchase = await findOwnPurchase(c, c.req.valid("param").id);

    return c.json({
      purchase: serializePurchase(await cancelPurchase(c, purchase)),
    });
  },
});
