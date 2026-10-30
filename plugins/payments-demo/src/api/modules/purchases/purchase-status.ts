import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { Payment } from "@vitnode/core/api/models/payments";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { PAYMENT_STATUSES } from "@vitnode/core/database/payments";

import { DEMO_ITEMS, type DemoItemId, purchaseReference } from "@/catalog";

export const zodPurchase = z.object({
  amount: z.number(),
  createdAt: z.string(),
  currency: z.string(),
  id: z.number(),
  itemId: z.string(),
  /** `true` once a payment for this purchase is `succeeded` - and from then on, for good. */
  paid: z.boolean(),
  payment: z
    .object({
      expiresAt: z.string(),
      id: z.string(),
      providerId: z.string(),
      status: z.enum(PAYMENT_STATUSES),
    })
    .nullable(),
  title: z.string(),
});

export type PurchaseResponse = z.infer<typeof zodPurchase>;

/**
 * A purchase with its payment state, derived from core's stored payments: the
 * purchase is paid once any attempt for its reference succeeded. The latest
 * open attempt is refreshed from the provider when `refresh` is set, so a
 * customer back from checkout sees confirmation even if the webhook is late.
 */
export const describePurchase = async (
  c: Context<EnvVitNode>,
  purchase: { createdAt: Date; id: number; itemId: string },
  { refresh, userId }: { refresh: boolean; userId: number },
): Promise<PurchaseResponse> => {
  const payments = c.get("payments");
  const attempts = await payments.listByReference(
    purchaseReference(purchase.id),
  );
  let latest: Payment | undefined = attempts[0];

  if (
    refresh &&
    latest &&
    (latest.status === "pending" || latest.status === "processing")
  ) {
    latest = await payments.getForUser({
      paymentId: latest.id,
      refresh: true,
      userId,
    });
  }

  const item = DEMO_ITEMS[purchase.itemId as DemoItemId];

  return {
    amount: item.amount,
    createdAt: purchase.createdAt.toISOString(),
    currency: item.currency,
    id: purchase.id,
    itemId: purchase.itemId,
    paid:
      latest?.status === "succeeded" ||
      attempts.some(attempt => attempt.status === "succeeded"),
    payment: latest
      ? {
          expiresAt: latest.expiresAt.toISOString(),
          id: latest.id,
          providerId: latest.providerId,
          status: latest.status,
        }
      : null,
    title: item.title,
  };
};
