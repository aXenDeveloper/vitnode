import type { PaymentErrorCode } from "@vitnode/core/api/lib/payments/errors";
import type { EnvVariablesVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { PaymentsModel } from "@vitnode/core/api/models/payments";

import { PaymentError } from "@vitnode/core/api/lib/payments/errors";
import { and, eq } from "drizzle-orm";

import { DEMO_ITEMS, type DemoItemId, purchaseReference } from "@/catalog";
import { payments_demo_purchases } from "@/database/purchases";

/** What the purchases service needs, passed in by whoever builds it. */
export interface PurchasesServiceDeps {
  /** In a route: `c.get("db")`. */
  db: Omit<EnvVariablesVitNode["db"], "$client">;
  /** In a route: `c.get("payments")`, which scopes every payment to this plugin. */
  payments: Pick<PaymentsModel, "createCheckout" | "listByReference">;
}

/**
 * What `checkout` resolves to. A refusal carries `"already_owned"` or the
 * `PaymentError` code core refused the checkout with; both are safe to show.
 */
export type CheckoutResult =
  | {
      checkout: { paymentId: string; purchaseId: number; redirectUrl: string };
      ok: true;
    }
  | { error: "already_owned" | PaymentErrorCode; ok: false };

/**
 * Purchases of the demo catalog. Build it per request:
 * `createPurchasesService({ db: c.get("db"), payments: c.get("payments") })`.
 */
export const createPurchasesService = ({
  db,
  payments,
}: PurchasesServiceDeps) => ({
  /**
   * Starts, or resumes, the hosted checkout for one item. The price comes from
   * `DEMO_ITEMS`, never from the caller. Safe to repeat: the purchase row is
   * created once per member and item, a paid purchase is refused as
   * `already_owned`, and core resumes or replaces an open attempt with the
   * same provider idempotency key, so a retry never charges twice.
   *
   * No transaction spans the provider call: the purchase row commits first and
   * core records the attempt before it talks to the provider.
   */
  checkout: async ({
    actor,
    itemId,
    providerId,
  }: {
    actor: { id: number };
    itemId: DemoItemId;
    providerId: string;
  }): Promise<CheckoutResult> => {
    const item = DEMO_ITEMS[itemId];

    await db
      .insert(payments_demo_purchases)
      .values({ itemId, userId: actor.id })
      .onConflictDoNothing();
    const [purchase] = await db
      .select({ id: payments_demo_purchases.id })
      .from(payments_demo_purchases)
      .where(
        and(
          eq(payments_demo_purchases.userId, actor.id),
          eq(payments_demo_purchases.itemId, itemId),
        ),
      )
      .limit(1);
    if (!purchase) {
      throw new Error(`The purchase of "${itemId}" was not stored.`);
    }

    const reference = purchaseReference(purchase.id);
    const attempts = await payments.listByReference(reference);
    if (attempts.some(attempt => attempt.status === "succeeded")) {
      return { error: "already_owned", ok: false };
    }

    try {
      const checkout = await payments.createCheckout({
        amount: item.amount,
        cancelPath: `/payments-demo/purchases/${purchase.id}`,
        currency: item.currency,
        description: "VitNode demo sticker pack",
        providerId,
        reference,
        successPath: `/payments-demo/purchases/${purchase.id}`,
        userId: actor.id,
      });

      return {
        checkout: {
          paymentId: checkout.paymentId,
          purchaseId: purchase.id,
          redirectUrl: checkout.redirectUrl,
        },
        ok: true,
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        return { error: error.code, ok: false };
      }
      throw error;
    }
  },
});
