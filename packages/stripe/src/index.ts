import type {
  PaymentCheckoutState,
  PaymentProviderApiPlugin,
} from "@vitnode/core/api/lib/payments/provider";

import {
  PaymentProviderError,
  PaymentWebhookVerificationError,
} from "@vitnode/core/api/lib/payments/errors";
import Stripe from "stripe";

/**
 * The Stripe API version every request and webhook payload of this adapter is
 * pinned to: the version the installed `stripe` SDK was generated for. Select
 * the same version on the webhook endpoint in the Stripe Dashboard.
 */
export const STRIPE_API_VERSION = Stripe.API_VERSION;

const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);
const MAX_AMOUNT = 99_999_999;

const KEY_PATTERN = /^(?:sk|rk)_(test|live)_[A-Za-z0-9]+$/;

const METADATA_PAYMENT_ID = "vitnode_payment_id";
const METADATA_PROVIDER_ID = "vitnode_provider_id";

type Session = Stripe.Checkout.Session;

const toProviderError = (error: unknown): PaymentProviderError => {
  if (error instanceof PaymentProviderError) return error;
  if (!(error instanceof Stripe.errors.StripeError)) {
    return new PaymentProviderError({
      code: "unknown",
      kind: "unavailable",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const message = `${error.type}${error.code ? ` (${error.code})` : ""}: ${error.message}`;

  if (
    error instanceof Stripe.errors.StripeAuthenticationError ||
    error instanceof Stripe.errors.StripePermissionError
  ) {
    return new PaymentProviderError({
      code: "stripe_credentials",
      kind: "configuration",
      message,
    });
  }

  if (
    error instanceof Stripe.errors.StripeIdempotencyError &&
    error.statusCode !== 409 &&
    error.code !== "idempotency_key_in_use"
  ) {
    return new PaymentProviderError({
      code: "idempotency_conflict",
      kind: "rejected",
      message,
    });
  }

  if (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.statusCode !== 409 &&
    error.statusCode !== 429
  ) {
    return new PaymentProviderError({
      code: error.code ?? "invalid_request",
      kind: "rejected",
      message,
    });
  }

  return new PaymentProviderError({
    code: error.code ?? "stripe_unavailable",
    kind: "unavailable",
    message,
  });
};

const statusOf = (
  session: Session,
  paymentIntent: null | Stripe.PaymentIntent,
): PaymentCheckoutState["status"] => {
  if (session.status === "expired") return "expired";
  if (session.status !== "complete") return "pending";
  if (session.payment_status === "paid") return "succeeded";

  if (
    paymentIntent?.status === "requires_payment_method" ||
    paymentIntent?.status === "canceled"
  ) {
    return "failed";
  }

  return "processing";
};

const stateOf = (
  session: Session,
  status: PaymentCheckoutState["status"],
): PaymentCheckoutState => ({
  amount: session.amount_total,
  checkoutId: session.id,
  currency: session.currency,
  expiresAt: new Date(session.expires_at * 1000),
  livemode: session.livemode,
  paymentId: session.metadata?.[METADATA_PAYMENT_ID] ?? null,
  providerStatus: `${session.status ?? "unknown"}/${session.payment_status}`,
  status,
  url: session.status === "open" ? session.url : null,
});

/**
 * A Stripe Checkout provider instance for `payments.providers` in the API
 * config. Payments use Stripe-hosted Checkout in `payment` mode with the
 * amount and currency the server decided; the customer never sees a VitNode
 * card form.
 *
 * Give each instance its own `id`, and add a webhook endpoint for it in Stripe
 * at `{VITNODE_API_URL}/api/@vitnode/core/payments/webhooks/{id}` listening to
 * `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
 * `checkout.session.async_payment_failed` and `checkout.session.expired`.
 *
 * Test or live mode follows the secret key (`sk_test_`/`rk_test_` or
 * `sk_live_`/`rk_live_`); a webhook from the other mode is refused.
 *
 * Server-only.
 *
 * @throws At startup, when `secretKey` or `webhookSecret` is missing or
 * malformed - never a half-configured provider.
 *
 * @example
 * ```ts
 * import { StripePaymentAdapter } from "@vitnode/stripe";
 *
 * buildApiConfig({
 *   payments: {
 *     providers: [
 *       StripePaymentAdapter({
 *         id: "stripe-main",
 *         secretKey: process.env.STRIPE_SECRET_KEY,
 *         webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
 *       }),
 *     ],
 *   },
 *   // ...
 * });
 * ```
 */
export const StripePaymentAdapter = ({
  id,
  name = "Stripe",
  secretKey,
  webhookSecret,
}: {
  /** The instance id, e.g. `stripe-main`. Unique across providers; never rename it while payments are open. */
  id: string;
  /** Shown to customers when several providers are offered. Defaults to `"Stripe"`. */
  name?: string;
  /** A secret (`sk_`) or restricted (`rk_`) key with write access to Checkout Sessions. */
  secretKey: string | undefined;
  /** The signing secret (`whsec_`) of this instance's webhook endpoint. */
  webhookSecret: string | undefined;
}): PaymentProviderApiPlugin => {
  const keyMatch = secretKey ? KEY_PATTERN.exec(secretKey) : null;
  if (!secretKey || !keyMatch) {
    throw new Error(
      `[VitNode payments] Stripe provider "${id}" needs \`secretKey\`: a Stripe secret key starting with sk_test_, sk_live_, rk_test_ or rk_live_.`,
    );
  }
  if (!webhookSecret?.startsWith("whsec_")) {
    throw new Error(
      `[VitNode payments] Stripe provider "${id}" needs \`webhookSecret\`: the endpoint's signing secret starting with whsec_.`,
    );
  }

  const livemode = keyMatch[1] === "live";
  let client: Stripe | undefined;
  const stripe = (): Stripe => {
    client ??= new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
      appInfo: { name: "VitNode", url: "https://vitnode.com" },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });

    return client;
  };

  const retrieveCheckout = async (checkoutId: string) => {
    try {
      const session = await stripe().checkout.sessions.retrieve(checkoutId, {
        expand: ["payment_intent"],
      });
      const paymentIntent =
        typeof session.payment_intent === "object"
          ? session.payment_intent
          : null;

      return stateOf(session, statusOf(session, paymentIntent));
    } catch (error) {
      throw toProviderError(error);
    }
  };

  return {
    id,
    name,
    type: "stripe",

    validateAmount: ({ amount, currency }) => {
      if (amount > MAX_AMOUNT) {
        throw new PaymentProviderError({
          code: "amount_too_large",
          kind: "rejected",
          message: `Stripe charges at most ${MAX_AMOUNT} minor units.`,
        });
      }
      if (THREE_DECIMAL_CURRENCIES.has(currency) && amount % 10 !== 0) {
        throw new PaymentProviderError({
          code: "amount_precision",
          kind: "rejected",
          message: `Stripe takes ${currency.toUpperCase()} amounts in multiples of 10 minor units.`,
        });
      }
    },

    createCheckout: async args => {
      try {
        const session = await stripe().checkout.sessions.create(
          {
            mode: "payment",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: args.currency,
                  unit_amount: args.amount,
                  product_data: { name: args.description },
                },
              },
            ],
            adaptive_pricing: { enabled: false },
            client_reference_id: args.paymentId,
            metadata: {
              [METADATA_PAYMENT_ID]: args.paymentId,
              [METADATA_PROVIDER_ID]: id,
            },
            payment_intent_data: {
              metadata: {
                [METADATA_PAYMENT_ID]: args.paymentId,
                [METADATA_PROVIDER_ID]: id,
              },
            },
            expires_at: Math.floor(args.expiresAt.getTime() / 1000),
            success_url: args.successUrl,
            cancel_url: args.cancelUrl,
          },
          { idempotencyKey: args.idempotencyKey },
        );

        if (!session.url && session.status === "open") {
          throw new PaymentProviderError({
            code: "missing_url",
            kind: "unavailable",
            message: `Checkout Session ${session.id} has no URL.`,
          });
        }

        return {
          ...stateOf(session, statusOf(session, null)),
          url: session.url ?? "",
        };
      } catch (error) {
        throw toProviderError(error);
      }
    },

    retrieveCheckout,

    expireCheckout: async checkoutId => {
      try {
        const session = await stripe().checkout.sessions.expire(checkoutId);

        return stateOf(session, statusOf(session, null));
      } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          return await retrieveCheckout(checkoutId);
        }

        throw toProviderError(error);
      }
    },

    verifyWebhook: async ({ body, headers }) => {
      const signature = headers.get("stripe-signature");
      if (!signature) {
        throw new PaymentWebhookVerificationError(
          "Missing Stripe-Signature header.",
        );
      }

      let event: Stripe.Event;
      try {
        event = await Stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret,
        );
      } catch (error) {
        throw new PaymentWebhookVerificationError(
          error instanceof Error ? error.message : "Invalid Stripe signature.",
        );
      }

      if (event.livemode !== livemode) {
        throw new PaymentWebhookVerificationError(
          `Stripe provider "${id}" uses ${livemode ? "live" : "test"} keys but received a ${event.livemode ? "live" : "test"} event.`,
        );
      }

      const ignored = {
        eventId: event.id,
        kind: "ignored",
        type: event.type,
      } as const;

      switch (event.type) {
        case "checkout.session.async_payment_failed":
        case "checkout.session.async_payment_succeeded":
        case "checkout.session.completed":
        case "checkout.session.expired": {
          const session = event.data.object;
          if (session.metadata?.[METADATA_PROVIDER_ID] !== id) return ignored;

          const status =
            event.type === "checkout.session.async_payment_failed"
              ? "failed"
              : statusOf(session, null);

          return {
            checkout: stateOf(session, status),
            eventId: event.id,
            kind: "checkout",
            type: event.type,
          };
        }
        default:
          return ignored;
      }
    },
  };
};
