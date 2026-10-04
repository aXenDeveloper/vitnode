import { z } from "zod";

import type {
  PurchaseRow,
  SubscriptionRow,
} from "@/api/models/payments/shared";

import { CURRENCY_DISPLAYS } from "@/payments/money";
import {
  BILLING_INTERVALS,
  DISPUTE_STATUSES,
  FULFILLMENT_STATUSES,
  OFFER_MODES,
  PURCHASE_PAYMENT_STATUSES,
  purchaseDisplayState,
  REFUND_STATUSES,
  SUBSCRIPTION_STATUSES,
  subscriptionDisplayState,
} from "@/payments/status";

export const zodPaymentsSettings = z.object({
  currencies: z.array(
    z.object({ code: z.string(), currencyDisplay: z.enum(CURRENCY_DISPLAYS) }),
  ),
  defaultCurrency: z.string().nullable(),
  defaultProvider: z.string().nullable(),
  enabled: z.boolean(),
  providers: z.array(
    z.object({
      capabilities: z.object({
        currencies: z.array(z.string()),
        customerPortal: z.boolean(),
        intervals: z.array(z.enum(BILLING_INTERVALS)),
        oneTimePayments: z.boolean(),
        subscriptions: z.boolean(),
      }),
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export const zodPurchase = z.object({
  amount: z.number().int(),
  createdAt: z.date(),
  currency: z.string(),
  displayState: z.enum([
    "awaiting_payment",
    "failed",
    "fulfilled",
    "fulfillment_failed",
    "fulfillment_pending",
    "paid",
    "partially_refunded",
    "processing",
    "refunded",
  ]),
  disputeStatus: z.enum(DISPUTE_STATUSES).nullable(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES),
  id: z.string(),
  interval: z.enum(BILLING_INTERVALS).nullable(),
  mode: z.enum(OFFER_MODES),
  offerId: z.string(),
  offerName: z.string(),
  paidAt: z.date().nullable(),
  paymentStatus: z.enum(PURCHASE_PAYMENT_STATUSES),
  pluginId: z.string(),
  provider: z.string(),
  refundedAmount: z.number().int(),
  refundStatus: z.enum(REFUND_STATUSES),
});

export const zodSubscription = z.object({
  amount: z.number().int(),
  cancelAt: z.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.date(),
  currency: z.string(),
  currentPeriodEnd: z.date().nullable(),
  displayState: z.enum([
    "active",
    "cancellation_scheduled",
    "ended",
    "incomplete",
    "needs_attention",
  ]),
  endedAt: z.date().nullable(),
  id: z.string(),
  interval: z.enum(BILLING_INTERVALS),
  offerId: z.string(),
  offerName: z.string(),
  paidThrough: z.date().nullable(),
  pluginId: z.string(),
  provider: z.string(),
  status: z.enum(SUBSCRIPTION_STATUSES),
});

/** A purchase as its owner may see it - no internal ids, no provider refs. */
export const serializePurchase = (
  row: PurchaseRow,
): z.infer<typeof zodPurchase> => ({
  amount: row.amount,
  createdAt: row.createdAt,
  currency: row.currency,
  displayState: purchaseDisplayState(row),
  disputeStatus: row.disputeStatus,
  fulfillmentStatus: row.fulfillmentStatus,
  id: row.publicId,
  interval: row.interval,
  mode: row.mode,
  offerId: row.offerId,
  offerName: row.offerName,
  paidAt: row.paidAt,
  paymentStatus: row.paymentStatus,
  pluginId: row.pluginId,
  provider: row.provider,
  refundedAmount: row.refundedAmount,
  refundStatus: row.refundStatus,
});

export const serializeSubscription = (
  row: SubscriptionRow,
): z.infer<typeof zodSubscription> => ({
  amount: row.amount,
  cancelAt: row.cancelAt,
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  createdAt: row.createdAt,
  currency: row.currency,
  currentPeriodEnd: row.currentPeriodEnd,
  displayState: subscriptionDisplayState(row),
  endedAt: row.endedAt,
  id: row.publicId,
  interval: row.interval,
  offerId: row.offerId,
  offerName: row.offerName,
  paidThrough: row.paidThrough,
  pluginId: row.pluginId,
  provider: row.provider,
  status: row.status,
});

export const zodPublicId = z.object({ id: z.uuid() });

export const paymentsErrorResponses = {
  400: { description: "The request cannot be fulfilled as asked" },
  401: { description: "Not signed in" },
  404: { description: "Not found, or not yours" },
  409: { description: "Conflicts with the current state" },
  503: { description: "Payments are disabled, or the provider did not answer" },
} as const;
