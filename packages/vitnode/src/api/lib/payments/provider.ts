import type { PaymentStatus } from "./status";

/**
 * A provider's view of one hosted checkout, normalized. Adapters map their own
 * objects to this shape; provider SDK types never leave the adapter.
 */
export interface PaymentCheckoutState {
  /** The total the provider will charge, in minor units. `null` when the provider did not say. */
  amount: null | number;
  /** The provider's checkout id, e.g. a Stripe Checkout Session id. */
  checkoutId: string;
  /** Lowercase ISO 4217 code, or `null` when the provider did not say. */
  currency: null | string;
  /** When the checkout stops accepting payments. */
  expiresAt?: Date | null;
  /** Whether the provider ran this checkout with live credentials. `null` when unknown. */
  livemode?: boolean | null;
  /**
   * The VitNode payment id the adapter put in the checkout's metadata
   * (`PaymentCreateCheckoutArgs.paymentId`). Lets core match an event that
   * arrives before the checkout id was stored locally.
   */
  paymentId: null | string;
  /** The provider's own status, for diagnostics only, e.g. `complete/unpaid`. At most 50 characters. */
  providerStatus: string;
  /**
   * The normalized status. Report `succeeded` only when the provider confirms
   * the money, `processing` when the customer finished but payment is still
   * settling, and `failed` only for a final failure of this checkout - never for
   * a declined card the customer can still retry on the same page.
   */
  status: PaymentStatus;
  /** The hosted page to send the customer to, while it is open. */
  url?: null | string;
}

/** What core hands an adapter to create a hosted checkout. Every value is decided on the server. */
export interface PaymentCreateCheckoutArgs {
  /** Positive integer in minor units, already validated. */
  amount: number;
  /** Where the provider sends a customer who gives up. Absolute, on the web origin. */
  cancelUrl: string;
  /** Lowercase ISO 4217 code, already validated. */
  currency: string;
  /** One line shown to the customer on the hosted page. */
  description: string;
  /**
   * When the checkout must stop accepting payments. Pass it to the provider,
   * so a checkout never outlives the attempt that created it.
   */
  expiresAt: Date;
  /**
   * Stable for the attempt: send it as the provider's idempotency key, so a
   * retried call returns the checkout the first call created instead of a
   * second one.
   */
  idempotencyKey: string;
  /** The VitNode payment id. Store it in the checkout's signed metadata and return it as `paymentId`. */
  paymentId: string;
  /** Where the provider sends the customer after paying. Absolute, on the web origin. Never proof of payment. */
  successUrl: string;
}

/** A verified webhook, normalized. */
export type PaymentWebhookEvent =
  | {
      checkout: PaymentCheckoutState;
      /** The provider's event id. Core records it to skip redeliveries. */
      eventId: string;
      kind: "checkout";
      type: string;
    }
  | { eventId: string; kind: "ignored"; type: string };

/**
 * A payment provider instance, listed in the API config's `payments.providers`.
 * `@vitnode/stripe` is the official adapter; a custom provider implements this
 * shape. Server-only: an instance holds secrets.
 *
 * The flow is a hosted redirect: core persists a local attempt, calls
 * `createCheckout`, and sends the customer to the returned `url`. The provider
 * reports the outcome to `POST /api/@vitnode/core/payments/webhooks/{id}`,
 * which core verifies with `verifyWebhook` before changing anything.
 *
 * Throw `PaymentProviderError` for provider failures and
 * `PaymentWebhookVerificationError` for a webhook that does not verify. Both
 * come from `@vitnode/core/api/lib/payments/errors`.
 */
export interface PaymentProviderApiPlugin {
  /**
   * Creates a hosted checkout. Must be idempotent on `idempotencyKey`: core
   * calls it again with the same arguments after a timeout.
   */
  createCheckout: (
    args: PaymentCreateCheckoutArgs,
  ) => Promise<PaymentCheckoutState & { url: string }>;
  /**
   * Closes an open checkout, so a new attempt can replace it. Returns the
   * checkout's state afterwards - which may be `processing` or `succeeded` if
   * the customer finished first. Optional: without it, an open checkout blocks a
   * new attempt for the same reference until it expires.
   */
  expireCheckout?: (checkoutId: string) => Promise<PaymentCheckoutState>;
  /**
   * The instance id: unique across `payments.providers`, lowercase letters,
   * digits, `-` and `_`. It is stored on every payment and is the last segment
   * of the webhook URL, so never rename it while payments are open.
   */
  id: string;
  /** Display name, e.g. `"Stripe"`. Safe to show in the browser. */
  name: string;
  /**
   * Reads a checkout's current state from the provider. Core uses it to recover
   * from missed webhooks and to refresh a status the customer is waiting on.
   * Optional, but without it a missed webhook is only fixed by a redelivery.
   */
  retrieveCheckout?: (checkoutId: string) => Promise<PaymentCheckoutState>;
  /** The adapter kind, e.g. `"stripe"`. Several instances may share a type. */
  type: string;
  /**
   * Refuses an amount the provider cannot charge in `currency` - a minimum, a
   * maximum, or a rounding rule. Throw `PaymentProviderError` with kind
   * `rejected`. Optional.
   */
  validateAmount?: (args: { amount: number; currency: string }) => void;
  /**
   * Verifies a webhook against the exact bytes received and its headers, then
   * normalizes it. Return `kind: "ignored"` for verified events the adapter
   * does not handle. Throw `PaymentWebhookVerificationError` when it does not
   * verify; core then answers `400` and changes nothing.
   */
  verifyWebhook: (args: {
    body: Uint8Array;
    headers: Headers;
  }) => Promise<PaymentWebhookEvent>;
}

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;

/**
 * Checks the configured provider instances: each needs an id that is
 * URL-safe and unique. Run once at startup.
 *
 * @throws When an id is missing, malformed or used twice.
 */
export const validatePaymentProviders = (
  providers: readonly PaymentProviderApiPlugin[],
): PaymentProviderApiPlugin[] => {
  const seen = new Set<string>();

  for (const provider of providers) {
    if (
      typeof provider.id !== "string" ||
      !PROVIDER_ID_PATTERN.test(provider.id)
    ) {
      throw new Error(
        `[VitNode payments] Provider id "${provider.id}" is invalid. Use 1-100 lowercase letters, digits, "-" or "_", starting with a letter or digit.`,
      );
    }

    if (seen.has(provider.id)) {
      throw new Error(
        `[VitNode payments] Provider id "${provider.id}" is configured twice. Give each instance in \`payments.providers\` its own id.`,
      );
    }

    seen.add(provider.id);
  }

  return [...providers];
};
