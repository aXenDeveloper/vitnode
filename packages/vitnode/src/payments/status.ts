/**
 * Payments keeps one status per concern instead of one status for everything.
 * A purchase can be `paid` while its fulfillment `failed`, and refunding part of
 * it never changes either of those.
 */

/** Whether the buyer's money arrived. Never moves backwards from `paid`. */
export const PURCHASE_PAYMENT_STATUSES = [
  "awaiting_payment",
  "processing",
  "paid",
  "failed",
  "expired",
  "canceled",
] as const;
export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];

/** Whether the plugin delivered what was paid for. Separate from payment. */
export const FULFILLMENT_STATUSES = [
  "not_started",
  "pending",
  "fulfilled",
  "failed",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const REFUND_STATUSES = ["none", "partial", "full"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** A dispute's state, reduced to what a reader of the record needs. */
export const DISPUTE_STATUSES = ["open", "won", "lost"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** One hosted checkout attempt for a purchase. */
export const CHECKOUT_STATUSES = [
  /** Persisted, provider not asked yet. */
  "creating",
  /** The provider call ended without an answer - it may or may not exist. */
  "unknown",
  "open",
  "complete",
  "expired",
  /** The provider refused to create it. */
  "failed",
] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "canceled",
  "incomplete_expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses after which a subscription bills nobody again. */
export const TERMINAL_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "canceled",
  "incomplete_expired",
];

export const INVOICE_STATUSES = [
  "open",
  "paid",
  "payment_failed",
  "action_required",
  "void",
  "uncollectible",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const OFFER_MODES = ["one_time", "subscription"] as const;
export type OfferMode = (typeof OFFER_MODES)[number];

const PAYMENT_RANK: Record<PurchasePaymentStatus, number> = {
  awaiting_payment: 0,
  processing: 1,
  canceled: 2,
  expired: 2,
  failed: 2,
  paid: 3,
};

/**
 * The status a purchase moves to when `observed` is reported for it.
 *
 * Moves only forward: an older snapshot that still says `awaiting_payment`
 * cannot undo `processing`, and nothing undoes `paid`. A terminal failure can
 * still become `paid` - an asynchronous payment that settles after its checkout
 * was marked expired locally is money that arrived, and history has to say so.
 */
export const nextPurchasePaymentStatus = (
  current: PurchasePaymentStatus,
  observed: PurchasePaymentStatus,
): PurchasePaymentStatus => {
  if (current === "paid") return "paid";
  if (observed === "paid") return "paid";
  if (PAYMENT_RANK[current] === 2) return current;

  return PAYMENT_RANK[observed] > PAYMENT_RANK[current] ? observed : current;
};

/** What a purchase row looks like to someone reading it - one label, derived. */
export type PurchaseDisplayState =
  | "awaiting_payment"
  | "failed"
  | "fulfilled"
  | "fulfillment_failed"
  | "fulfillment_pending"
  | "paid"
  | "partially_refunded"
  | "processing"
  | "refunded";

export const purchaseDisplayState = (purchase: {
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PurchasePaymentStatus;
  refundStatus: RefundStatus;
}): PurchaseDisplayState => {
  switch (purchase.paymentStatus) {
    case "awaiting_payment":
      return "awaiting_payment";
    case "canceled":
    case "expired":
    case "failed":
      return "failed";
    case "paid":
      break;
    case "processing":
      return "processing";
  }

  if (purchase.refundStatus === "full") return "refunded";
  if (purchase.refundStatus === "partial") return "partially_refunded";
  if (purchase.fulfillmentStatus === "failed") return "fulfillment_failed";
  if (purchase.fulfillmentStatus === "pending") return "fulfillment_pending";
  if (purchase.fulfillmentStatus === "fulfilled") return "fulfilled";

  return "paid";
};

export type SubscriptionDisplayState =
  | "active"
  | "cancellation_scheduled"
  | "ended"
  | "incomplete"
  | "needs_attention";

export const subscriptionDisplayState = (subscription: {
  cancelAtPeriodEnd: boolean;
  status: SubscriptionStatus;
}): SubscriptionDisplayState => {
  if (TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
    return "ended";
  }

  if (subscription.status === "incomplete") return "incomplete";

  if (
    subscription.status === "past_due" ||
    subscription.status === "unpaid" ||
    subscription.status === "paused"
  ) {
    return "needs_attention";
  }

  return subscription.cancelAtPeriodEnd ? "cancellation_scheduled" : "active";
};

/** Whether a purchase is finished, so polling for it can stop. */
export const isPurchaseSettled = (purchase: {
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PurchasePaymentStatus;
}): boolean =>
  purchase.paymentStatus !== "awaiting_payment" &&
  purchase.paymentStatus !== "processing" &&
  (purchase.paymentStatus !== "paid" ||
    purchase.fulfillmentStatus === "fulfilled" ||
    purchase.fulfillmentStatus === "failed");
