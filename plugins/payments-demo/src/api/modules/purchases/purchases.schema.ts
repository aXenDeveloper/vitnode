import { z } from "@hono/zod-openapi";
import { PAYMENT_STATUSES } from "@vitnode/core/database/payments";

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
