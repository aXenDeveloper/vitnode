import type {
  PaymentPurchaseSnapshot,
  PaymentSubscriptionSnapshot,
} from "@vitnode/core/payments";

/** Whether a stored grant is usable at `now`. Checked on every read. */
export const hasActiveAccess = (
  grant: undefined | { accessUntil: Date | null; revokedAt: Date | null },
  now: Date = new Date(),
): boolean =>
  !!grant &&
  grant.revokedAt === null &&
  (grant.accessUntil === null || grant.accessUntil > now);

/**
 * The example's refund policy: only a confirmed refund of the whole price
 * takes the one-time purchase away. A partial refund is a goodwill gesture.
 */
export const shouldRevokeAfterRefund = (
  purchase: Pick<PaymentPurchaseSnapshot, "refundStatus">,
): boolean => purchase.refundStatus === "full";

/**
 * How long a subscriber keeps the feature: until the end of the last period
 * a verified payment covers. A failed renewal does not shorten it, a scheduled
 * cancellation keeps it until then, and a subscription that ended early ends it
 * when it ended.
 */
export const subscriptionAccessUntil = (
  subscription: Pick<PaymentSubscriptionSnapshot, "endedAt" | "paidThrough">,
): Date | null => {
  const { endedAt, paidThrough } = subscription;

  if (!paidThrough) return null;
  if (endedAt && endedAt < paidThrough) return endedAt;

  return paidThrough;
};
