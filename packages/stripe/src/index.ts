import type {
  PaymentProvider,
  ProviderCheckout,
  ProviderDispute,
  ProviderInvoice,
  ProviderRefund,
  ProviderSubscription,
  ProviderWebhookEvent,
  ProviderWebhookTarget,
} from "@vitnode/core/payments";

import {
  PaymentProviderError,
  PaymentsConfigError,
  PaymentWebhookSignatureError,
} from "@vitnode/core/payments";
import Stripe from "stripe";

/**
 * The Stripe API version every request and every webhook payload is read
 * against - the one `stripe@23` pins. Configure your webhook endpoint with the
 * same version. Typed as the SDK's own literal, so upgrading the SDK without
 * reviewing this adapter fails to compile.
 */
export const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-09-30.endive";

/**
 * Currencies this adapter charges in. For each one, Stripe's smallest unit is
 * the ISO 4217 minor unit VitNode uses, so amounts pass through unchanged.
 * Currencies Stripe counts differently from ISO (for example ISK, HUF, TWD or
 * the three-decimal currencies) are left out rather than converted on a guess.
 */
export const STRIPE_SUPPORTED_CURRENCIES = [
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "JPY",
  "KRW",
  "MXN",
  "NOK",
  "NZD",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "USD",
] as const;

/** Stripe accepts at most eight digits for one amount. */
const STRIPE_MAX_AMOUNT = 99_999_999;

/** The webhook events this adapter turns into work. Subscribe to exactly these. */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "charge.refunded",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
] as const;

export interface StripePaymentProviderOptions {
  /**
   * A pre-built client. For tests (with a fake `httpClient`); production code
   * leaves it out and the adapter builds one from `secretKey`.
   */
  client?: Stripe;
  /** Narrow `STRIPE_SUPPORTED_CURRENCIES` to what your account accepts. */
  currencies?: readonly string[];
  /** Override when registering more than one Stripe account. Default `"stripe"`. */
  id?: string;
  /** A Customer Portal configuration id (`bpc_...`). Default: the account default. */
  portalConfigurationId?: string;
  /** `STRIPE_SECRET_KEY` - `sk_test_...`/`sk_live_...` or a restricted `rk_...` key. */
  secretKey: string | undefined;
  /** The signing secret of this endpoint - `whsec_...`. Not the API key. */
  webhookSecret: string | undefined;
}

const toDate = (seconds: null | number | undefined): Date | null =>
  typeof seconds === "number" ? new Date(seconds * 1000) : null;

const idOf = (
  value: null | string | undefined | { id: string },
): null | string => (typeof value === "string" ? value : (value?.id ?? null));

const upper = (currency: null | string | undefined): null | string =>
  currency ? currency.toUpperCase() : null;

/** Stripe failures in core's vocabulary - no SDK error escapes the adapter. */
const translateError = (error: unknown, action: string): never => {
  if (!(error instanceof Error)) throw error;

  const stripeError = error as Error & { code?: string; type?: string };
  const message = `Stripe could not ${action}: ${error.message}`;

  switch (stripeError.type) {
    case "StripeAPIError":
    case "StripeConnectionError":
      throw new PaymentProviderError("uncertain", message, { cause: error });
    case "StripeRateLimitError":
      throw new PaymentProviderError("unavailable", message, { cause: error });
    case "StripeInvalidRequestError":
      if (stripeError.code === "idempotency_key_in_use") {
        // A concurrent request with the same key is still running.
        throw new PaymentProviderError("unavailable", message, {
          cause: error,
        });
      }

      throw new PaymentProviderError(
        stripeError.code === "resource_missing" ? "not_found" : "rejected",
        message,
        { cause: error },
      );
    case "StripeAuthenticationError":
    case "StripeCardError":
    case "StripeIdempotencyError":
    case "StripePermissionError":
      throw new PaymentProviderError("rejected", message, { cause: error });
    default:
      // Anything unclassified may have reached Stripe; treat it as unknown.
      throw new PaymentProviderError("uncertain", message, { cause: error });
  }
};

const call = async <T>(action: string, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    return translateError(error, action);
  }
};

const SUBSCRIPTION_STATUSES: Record<string, ProviderSubscription["status"]> = {
  active: "active",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  past_due: "past_due",
  paused: "paused",
  // Trials are out of scope; a trial would still be "active" access-wise.
  trialing: "active",
  unpaid: "unpaid",
};

const DISPUTE_STATUSES: Record<string, ProviderDispute["status"]> = {
  lost: "lost",
  prevented: "won",
  warning_closed: "won",
  won: "won",
};

const REFUND_STATUSES: Record<string, ProviderRefund["status"]> = {
  canceled: "canceled",
  failed: "failed",
  pending: "pending",
  requires_action: "requires_action",
  succeeded: "succeeded",
};

/** Stripe's enums are open-ended strings; anything unrecognised reads as "not yet". */
const checkoutStatus = (status: null | string): ProviderCheckout["status"] =>
  status === "complete" || status === "expired" ? status : "open";

const checkoutPaymentStatus = (
  session: Stripe.Checkout.Session,
): ProviderCheckout["paymentStatus"] => {
  if (session.payment_status === "paid") return "paid";
  if (session.payment_status === "no_payment_required") {
    return "no_payment_required";
  }

  // A completed session stays "unpaid" both while a delayed method settles and
  // after it was declined; only the PaymentIntent tells the two apart.
  const intent = session.payment_intent;
  if (
    session.status === "complete" &&
    typeof intent === "object" &&
    intent !== null &&
    (intent.status === "requires_payment_method" || intent.status === "canceled")
  ) {
    return "failed";
  }

  return "unpaid";
};

const billingInterval = (
  interval: null | string | undefined,
): ProviderSubscription["interval"] => {
  if (interval === "month") return "month";
  if (interval === "year") return "year";

  return null;
};

const invoiceStatus = (status: null | string): ProviderInvoice["status"] => {
  switch (status) {
    case "paid":
      return "paid";
    case "uncollectible":
      return "uncollectible";
    case "void":
      return "void";
    default:
      return "open";
  }
};

const toCheckout = (session: Stripe.Checkout.Session): ProviderCheckout => ({
  amountTotal: session.amount_total,
  currency: upper(session.currency),
  customerId: idOf(session.customer),
  expiresAt: toDate(session.expires_at),
  id: session.id,
  paymentId: idOf(session.payment_intent),
  paymentStatus: checkoutPaymentStatus(session),
  reference:
    session.client_reference_id ?? session.metadata?.vitnode_reference ?? null,
  status: checkoutStatus(session.status),
  subscriptionId: idOf(session.subscription),
  url: session.url,
});

const toSubscription = (
  subscription: Stripe.Subscription,
): ProviderSubscription => {
  const item = subscription.items.data[0];

  return {
    amount: item?.price.unit_amount ?? null,
    cancelAt: toDate(subscription.cancel_at),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
    currency: upper(item?.price.currency),
    currentPeriodEnd: toDate(item?.current_period_end),
    customerId: idOf(subscription.customer) ?? "",
    endedAt: toDate(subscription.ended_at),
    id: subscription.id,
    interval: billingInterval(item?.price.recurring?.interval),
    latestInvoiceId: idOf(subscription.latest_invoice),
    priceId: item?.price.id ?? null,
    providerStatus: subscription.status,
    reference: subscription.metadata?.vitnode_reference ?? null,
    status: SUBSCRIPTION_STATUSES[subscription.status] ?? "incomplete",
  };
};

const toInvoice = (invoice: Stripe.Invoice): ProviderInvoice => {
  const subscriptionLine = invoice.lines.data.find(
    line => line.parent?.subscription_item_details ?? line.subscription,
  );
  const paidPayment = invoice.payments?.data.find(
    payment => payment.status === "paid",
  );

  return {
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    billingReason: invoice.billing_reason,
    currency: invoice.currency.toUpperCase(),
    id: invoice.id,
    paidAt: toDate(invoice.status_transitions.paid_at),
    paymentId: idOf(paidPayment?.payment.payment_intent),
    periodEnd: toDate(subscriptionLine?.period.end),
    periodStart: toDate(subscriptionLine?.period.start),
    providerStatus: invoice.status ?? "draft",
    status: invoiceStatus(invoice.status),
    subscriptionId: idOf(
      invoice.parent?.subscription_details?.subscription ??
        subscriptionLine?.subscription,
    ),
  };
};

/** The object an event concerns, or `null` for events this adapter ignores. */
const targetOf = (event: Stripe.Event): null | ProviderWebhookTarget => {
  switch (event.type) {
    case "charge.dispute.closed":
    case "charge.dispute.created":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.updated":
    case "charge.refunded":
    case "refund.created":
    case "refund.updated": {
      const paymentId = idOf(event.data.object.payment_intent);

      return paymentId ? { id: paymentId, kind: "payment" } : null;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.completed":
    case "checkout.session.expired":
      return { id: event.data.object.id, kind: "checkout" };
    case "customer.subscription.created":
    case "customer.subscription.deleted":
    case "customer.subscription.updated":
      return { id: event.data.object.id, kind: "subscription" };
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return { id: event.data.object.id, kind: "invoice", signal: "paid" };
    case "invoice.payment_action_required":
      return {
        id: event.data.object.id,
        kind: "invoice",
        signal: "action_required",
      };
    case "invoice.payment_failed":
      return {
        id: event.data.object.id,
        kind: "invoice",
        signal: "payment_failed",
      };
    default:
      return null;
  }
};

const scopeOfKey = (secretKey: string): "live" | "test" | null => {
  const match = /^(?:sk|rk)_(test|live)_/.exec(secretKey);

  return match ? (match[1] as "live" | "test") : null;
};

/**
 * Stripe for VitNode Payments: hosted Checkout for one-time payments and
 * monthly/yearly subscriptions, Customer Portal and signed webhooks.
 *
 * Throws at startup when explicitly configured with missing or malformed
 * credentials - register it only when `STRIPE_SECRET_KEY` is set.
 */
export const StripePaymentProvider = ({
  client,
  currencies = STRIPE_SUPPORTED_CURRENCIES,
  id = "stripe",
  portalConfigurationId,
  secretKey,
  webhookSecret,
}: StripePaymentProviderOptions): PaymentProvider => {
  if (!secretKey) {
    throw new PaymentsConfigError(
      `Stripe provider "${id}" has no secret key. Set STRIPE_SECRET_KEY (sk_test_... from the Stripe dashboard) or leave the provider out of "payments.providers".`,
    );
  }

  const scope = scopeOfKey(secretKey);

  if (!scope) {
    throw new PaymentsConfigError(
      `Stripe provider "${id}": the secret key must start with sk_test_, sk_live_, rk_test_ or rk_live_. A publishable key (pk_...) cannot be used on the server.`,
    );
  }

  if (!webhookSecret?.startsWith("whsec_")) {
    throw new PaymentsConfigError(
      `Stripe provider "${id}" needs STRIPE_WEBHOOK_SECRET (whsec_...) - the signing secret shown for your webhook endpoint, or printed by \`stripe listen\`.`,
    );
  }

  const unsupported = currencies.filter(
    code => !(STRIPE_SUPPORTED_CURRENCIES as readonly string[]).includes(code),
  );

  if (unsupported.length > 0) {
    throw new PaymentsConfigError(
      `Stripe provider "${id}" cannot charge in ${unsupported.join(", ")}. Supported: ${STRIPE_SUPPORTED_CURRENCIES.join(", ")}.`,
    );
  }

  const stripe =
    client ??
    new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
      appInfo: { name: "VitNode", url: "https://vitnode.com" },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });

  return {
    id,
    name: "Stripe",
    scope,
    currencies: [...currencies],

    checkAmount: ({ amount }) =>
      amount > STRIPE_MAX_AMOUNT
        ? "Stripe accepts at most 99,999,999 minor units for one payment."
        : null,

    customers: {
      create: async ({ email, name, userId }, { idempotencyKey }) => {
        const customer = await call(
          "create the customer",
          async () =>
            await stripe.customers.create(
              { email, metadata: { vitnode_user_id: String(userId) }, name },
              { idempotencyKey },
            ),
        );

        return { customerId: customer.id };
      },
    },

    checkout: {
      create: async (input, { idempotencyKey }) => {
        const metadata = {
          ...input.metadata,
          vitnode_reference: input.reference,
        };
        const session = await call(
          "create the checkout",
          async () =>
            await stripe.checkout.sessions.create(
              {
                cancel_url: input.cancelUrl,
                client_reference_id: input.reference,
                customer: input.customerId,
                expires_at: Math.floor(input.expiresAt.getTime() / 1000),
                line_items: [
                  {
                    price_data: {
                      currency: input.item.currency.toLowerCase(),
                      product_data: { name: input.item.name },
                      recurring: input.item.interval
                        ? { interval: input.item.interval }
                        : undefined,
                      unit_amount: input.item.amount,
                    },
                    quantity: 1,
                  },
                ],
                metadata,
                mode:
                  input.mode === "subscription" ? "subscription" : "payment",
                ...(input.mode === "subscription"
                  ? { subscription_data: { metadata } }
                  : { payment_intent_data: { metadata } }),
                success_url: input.successUrl,
              },
              { idempotencyKey },
            ),
        );

        return toCheckout(session);
      },
      expire: async checkoutId =>
        toCheckout(
          await call(
            "expire the checkout",
            async () => await stripe.checkout.sessions.expire(checkoutId),
          ),
        ),
      retrieve: async checkoutId =>
        toCheckout(
          await call(
            "read the checkout",
            async () =>
              await stripe.checkout.sessions.retrieve(checkoutId, {
                expand: ["payment_intent"],
              }),
          ),
        ),
    },

    payments: {
      retrieve: async paymentId => {
        const [intent, refunds, disputes] = await call(
          "read the payment",
          async () =>
            await Promise.all([
              stripe.paymentIntents.retrieve(paymentId),
              stripe.refunds.list({ limit: 100, payment_intent: paymentId }),
              stripe.disputes.list({ limit: 100, payment_intent: paymentId }),
            ]),
        );
        const mappedRefunds = refunds.data.map(refund => ({
          amount: refund.amount,
          id: refund.id,
          status: REFUND_STATUSES[refund.status ?? ""] ?? "pending",
        }));

        return {
          amount: intent.amount_received || intent.amount,
          // Only money that is confirmed back with the buyer - a pending refund
          // can still fail, and a plugin may revoke access on a full refund.
          amountRefunded: mappedRefunds
            .filter(refund => refund.status === "succeeded")
            .reduce((sum, refund) => sum + refund.amount, 0),
          currency: intent.currency.toUpperCase(),
          disputes: disputes.data.map(dispute => ({
            amount: dispute.amount,
            id: dispute.id,
            providerStatus: dispute.status,
            reason: dispute.reason,
            status: DISPUTE_STATUSES[dispute.status] ?? "open",
          })),
          id: intent.id,
          refunds: mappedRefunds,
        };
      },
    },

    subscriptions: {
      retrieve: async subscriptionId =>
        toSubscription(
          await call(
            "read the subscription",
            async () => await stripe.subscriptions.retrieve(subscriptionId),
          ),
        ),
      retrieveInvoice: async invoiceId =>
        toInvoice(
          await call(
            "read the invoice",
            async () =>
              await stripe.invoices.retrieve(invoiceId, {
                expand: ["payments"],
              }),
          ),
        ),
    },

    portal: {
      createSession: async ({ customerId, returnUrl }) => {
        const session = await call(
          "open the Customer Portal",
          async () =>
            await stripe.billingPortal.sessions.create({
              configuration: portalConfigurationId,
              customer: customerId,
              return_url: returnUrl,
            }),
        );

        return { url: session.url };
      },
    },

    webhooks: {
      verify: async ({ body, headers }): Promise<ProviderWebhookEvent> => {
        const signature = headers.get("stripe-signature");

        if (!signature) {
          throw new PaymentWebhookSignatureError(
            "The request has no Stripe-Signature header.",
          );
        }

        let event: Stripe.Event;

        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
          );
        } catch (error) {
          throw new PaymentWebhookSignatureError(
            error instanceof Error ? error.message : undefined,
          );
        }

        return {
          id: event.id,
          scope: event.livemode ? "live" : "test",
          target: targetOf(event),
          type: event.type,
        };
      },
    },
  };
};
