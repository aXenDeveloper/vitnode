import type { PAYMENT_STATUSES } from "@/database/payments";

/**
 * A payment attempt's normalized status.
 *
 * - `pending`: created locally; its hosted checkout may not exist yet, or is
 *   open and waiting for the customer.
 * - `processing`: the customer finished the checkout, but the provider has not
 *   confirmed the money yet (a delayed payment method).
 * - `succeeded`: the provider confirmed the payment. Terminal.
 * - `failed`: the provider reported the payment as failed for good, or refused
 *   to create the checkout. Terminal.
 * - `expired`: the checkout closed without a payment. Terminal.
 */
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Legal transitions. Terminal statuses have none, so a stale, duplicated or
 * out-of-order provider update can never move a payment out of `succeeded`.
 */
export const PAYMENT_TRANSITIONS: Readonly<
  Record<PaymentStatus, readonly PaymentStatus[]>
> = {
  pending: ["processing", "succeeded", "failed", "expired"],
  processing: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
  expired: [],
};

export const OPEN_PAYMENT_STATUSES = [
  "pending",
  "processing",
] as const satisfies readonly PaymentStatus[];

export const isOpenPaymentStatus = (status: PaymentStatus): boolean =>
  (OPEN_PAYMENT_STATUSES as readonly PaymentStatus[]).includes(status);

export const canTransitionPayment = (
  from: PaymentStatus,
  to: PaymentStatus,
): boolean => PAYMENT_TRANSITIONS[from].includes(to);
