import type { Money } from "./money";
import type {
  BillingInterval,
  DisputeStatus,
  InvoiceStatus,
  OfferMode,
  SubscriptionStatus,
} from "./status";

/**
 * What core asks a payment provider to do, in core's own vocabulary. An adapter
 * (for example `@vitnode/stripe`) translates these into SDK calls and its
 * objects back into the shapes below - no provider object ever reaches core or
 * a plugin.
 *
 * Every amount crossing this boundary is in ISO minor units (see `Money`). A
 * provider that counts a currency differently converts inside the adapter.
 */
export interface PaymentProvider {
  checkout: {
    create: (
      input: ProviderCheckoutInput,
      options: { idempotencyKey: string },
    ) => Promise<ProviderCheckout>;
    /** Closes an open checkout so it can no longer be paid. */
    expire: (checkoutId: string) => Promise<ProviderCheckout>;
    retrieve: (checkoutId: string) => Promise<ProviderCheckout>;
  };
  /**
   * Provider-specific limits on one charge. Returns why `money` cannot be
   * charged, or `null` when it can.
   */
  checkAmount?: (money: Money) => null | string;
  /** Codes this provider can charge in. Intersected with the install's own. */
  currencies: readonly string[];
  customers: {
    create: (
      input: { email: string; name: string; userId: number },
      options: { idempotencyKey: string },
    ) => Promise<{ customerId: string }>;
  };
  /** Stable id used in config, URLs and stored references - `"stripe"`. */
  id: string;
  /** Shown in the AdminCP and the billing screens. */
  name: string;
  payments: {
    /** Refund and dispute facts for one payment, read fresh. */
    retrieve: (paymentId: string) => Promise<ProviderPayment>;
  };
  /** Present only when the provider has a hosted billing portal. */
  portal?: {
    createSession: (input: {
      customerId: string;
      locale?: string;
      returnUrl: string;
    }) => Promise<{ url: string }>;
  };
  /**
   * Which account or environment references belong to - for Stripe `"test"`
   * or `"live"`. Stored next to every provider reference so ids from two
   * environments can never collide.
   */
  scope: string;
  /** Present only when the provider can bill on a schedule. */
  subscriptions?: {
    retrieve: (subscriptionId: string) => Promise<ProviderSubscription>;
    retrieveInvoice: (invoiceId: string) => Promise<ProviderInvoice>;
  };
  webhooks: {
    /**
     * Verifies the request against the provider's signature using the exact
     * bytes that arrived, then reduces it to a normalized event. Throws
     * `PaymentWebhookSignatureError` for anything not provably from the
     * provider.
     */
    verify: (input: {
      body: Uint8Array;
      headers: Headers;
    }) => Promise<ProviderWebhookEvent>;
  };
}

export interface PaymentProviderCapabilities {
  currencies: readonly string[];
  customerPortal: boolean;
  intervals: readonly BillingInterval[];
  oneTimePayments: boolean;
  subscriptions: boolean;
}

export const providerCapabilities = (
  provider: PaymentProvider,
): PaymentProviderCapabilities => ({
  currencies: provider.currencies,
  customerPortal: !!provider.portal,
  intervals: provider.subscriptions ? ["month", "year"] : [],
  oneTimePayments: true,
  subscriptions: !!provider.subscriptions,
});

export interface ProviderCheckoutInput {
  /** Cancel/back destination, built by core from the offer's return path. */
  cancelUrl: string;
  customerId: string;
  expiresAt: Date;
  /** Shown on the hosted page. */
  item: Money & { interval?: BillingInterval; name: string };
  locale?: string;
  mode: OfferMode;
  /** Small, non-sensitive strings copied onto provider objects. */
  metadata: Record<string, string>;
  /** Core's opaque purchase id, echoed back on every related object. */
  reference: string;
  successUrl: string;
}

export interface ProviderCheckout {
  /** In minor units, as charged - `null` until the provider knows it. */
  amountTotal: null | number;
  currency: null | string;
  customerId: null | string;
  expiresAt: Date | null;
  id: string;
  /** The payment the checkout created, for one-time purchases. */
  paymentId: null | string;
  paymentStatus: "no_payment_required" | "paid" | "unpaid";
  reference: null | string;
  status: "complete" | "expired" | "open";
  subscriptionId: null | string;
  url: null | string;
}

export interface ProviderSubscription {
  /** Recurring price in minor units, as the provider holds it. */
  amount: null | number;
  cancelAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  currency: null | string;
  /** When the current billing period ends - not proof that it is paid. */
  currentPeriodEnd: Date | null;
  customerId: string;
  endedAt: Date | null;
  id: string;
  interval: BillingInterval | null;
  latestInvoiceId: null | string;
  priceId: null | string;
  /** The provider's own status string, kept for support and debugging. */
  providerStatus: string;
  reference: null | string;
  status: SubscriptionStatus;
}

export interface ProviderInvoice {
  amountDue: number;
  amountPaid: number;
  billingReason: null | string;
  currency: string;
  id: string;
  paidAt: Date | null;
  paymentId: null | string;
  /** The service period this invoice bills for. */
  periodEnd: Date | null;
  periodStart: Date | null;
  providerStatus: string;
  /** `open` when unpaid; the webhook signal decides `payment_failed` / `action_required`. */
  status: Extract<InvoiceStatus, "open" | "paid" | "uncollectible" | "void">;
  subscriptionId: null | string;
}

export interface ProviderRefund {
  amount: number;
  id: string;
  status: "canceled" | "failed" | "pending" | "requires_action" | "succeeded";
}

export interface ProviderDispute {
  amount: number;
  id: string;
  providerStatus: string;
  reason: null | string;
  status: DisputeStatus;
}

export interface ProviderPayment {
  amount: number;
  /** Total refunded that has succeeded or is on its way. */
  amountRefunded: number;
  currency: string;
  disputes: ProviderDispute[];
  id: string;
  refunds: ProviderRefund[];
}

/** The object a webhook is about - core re-reads it before acting. */
export type ProviderWebhookTarget =
  | {
      id: string;
      kind: "invoice";
      signal: "action_required" | "paid" | "payment_failed" | "updated";
    }
  | { id: string; kind: "checkout" }
  | { id: string; kind: "payment" }
  | { id: string; kind: "subscription" };

export interface ProviderWebhookEvent {
  /** The provider's event id - the deduplication key. */
  id: string;
  /** Account/environment the event belongs to; compared with `provider.scope`. */
  scope: string;
  /** `null` for event types core does not use - acknowledged, never stored. */
  target: null | ProviderWebhookTarget;
  /** The provider's own event type, for the AdminCP. */
  type: string;
}

export type PaymentProviderErrorKind =
  /** The provider refused the request; repeating it will not help. */
  | "rejected"
  /** The object does not exist (in this account/environment). */
  | "not_found"
  /** No answer: the request may or may not have taken effect. */
  | "uncertain"
  /** Throttled or down; safe to try again later. */
  | "unavailable";

export class PaymentProviderError extends Error {
  constructor(
    kind: PaymentProviderErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PaymentProviderError";
    this.kind = kind;
  }

  readonly kind: PaymentProviderErrorKind;

  get retryable(): boolean {
    return this.kind === "uncertain" || this.kind === "unavailable";
  }
}

export const isPaymentProviderError = (
  error: unknown,
): error is PaymentProviderError =>
  error instanceof Error && error.name === "PaymentProviderError";

export class PaymentWebhookSignatureError extends Error {
  constructor(message = "The webhook signature could not be verified.") {
    super(message);
    this.name = "PaymentWebhookSignatureError";
  }
}

export const isPaymentWebhookSignatureError = (
  error: unknown,
): error is PaymentWebhookSignatureError =>
  error instanceof Error && error.name === "PaymentWebhookSignatureError";

/** Thrown by an adapter factory or core when explicit configuration is wrong. */
export class PaymentsConfigError extends Error {
  constructor(message: string) {
    super(`[VitNode Payments] ${message}`);
    this.name = "PaymentsConfigError";
  }
}
