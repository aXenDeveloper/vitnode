import { isPaymentProviderError } from "@vitnode/core/payments";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import {
  STRIPE_API_VERSION,
  STRIPE_WEBHOOK_EVENTS,
  StripePaymentProvider,
} from "./index";

const WEBHOOK_SECRET = "whsec_test_secret";
const SECRET_KEY = "sk_test_123";

interface RecordedRequest {
  body: string;
  headers: Record<string, string>;
  method: string;
  url: string;
}

/** A Stripe client whose network is a function - nothing leaves the process. */
const fakeStripe = (
  respond: (request: RecordedRequest) => { body: unknown; status?: number },
) => {
  const requests: RecordedRequest[] = [];
  const fetchFn = async (
    url: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request: RecordedRequest = {
      body: typeof init?.body === "string" ? init.body : "",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      method: init?.method ?? "GET",
      url: url instanceof Request ? url.url : url.toString(),
    };
    requests.push(request);
    const { body, status = 200 } = respond(request);

    return await Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "request-id": "req_1" },
        status,
      }),
    );
  };

  const client = new Stripe(SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(fetchFn),
    maxNetworkRetries: 0,
  });

  return { client, requests };
};

const provider = (client?: Stripe) =>
  StripePaymentProvider({
    client,
    secretKey: SECRET_KEY,
    webhookSecret: WEBHOOK_SECRET,
  });

const signed = async (payload: string, secret = WEBHOOK_SECRET) => {
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
  });

  return {
    body: new TextEncoder().encode(payload),
    headers: new Headers({ "stripe-signature": header }),
  };
};

const event = (type: string, object: Record<string, unknown>) =>
  JSON.stringify({
    api_version: STRIPE_API_VERSION,
    created: 1_790_000_000,
    data: { object },
    id: `evt_${type.replace(/\W/g, "_")}`,
    livemode: false,
    object: "event",
    pending_webhooks: 1,
    request: null,
    type,
  });

describe("StripePaymentProvider configuration", () => {
  it("explains a missing secret key", () => {
    expect(() =>
      StripePaymentProvider({
        secretKey: undefined,
        webhookSecret: WEBHOOK_SECRET,
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("refuses a publishable key on the server", () => {
    expect(() =>
      StripePaymentProvider({
        secretKey: "pk_test_1",
        webhookSecret: WEBHOOK_SECRET,
      }),
    ).toThrow(/publishable key/);
  });

  it("explains a missing webhook signing secret", () => {
    expect(() =>
      StripePaymentProvider({
        secretKey: SECRET_KEY,
        webhookSecret: undefined,
      }),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it("refuses a currency it would have to convert on a guess", () => {
    expect(() =>
      StripePaymentProvider({
        currencies: ["USD", "HUF"],
        secretKey: SECRET_KEY,
        webhookSecret: WEBHOOK_SECRET,
      }),
    ).toThrow(/cannot charge in HUF/);
  });

  it("scopes references by test or live mode from the key", () => {
    expect(provider().scope).toBe("test");
    expect(
      StripePaymentProvider({
        secretKey: "rk_live_1",
        webhookSecret: WEBHOOK_SECRET,
      }).scope,
    ).toBe("live");
  });

  it("does not expose credentials on the provider object", () => {
    expect(JSON.stringify(provider())).not.toContain(SECRET_KEY);
    expect(JSON.stringify(provider())).not.toContain(WEBHOOK_SECRET);
  });

  it("enforces Stripe's eight-digit amount limit", () => {
    expect(
      provider().checkAmount?.({ amount: 99_999_999, currency: "USD" }),
    ).toBeNull();
    expect(
      provider().checkAmount?.({ amount: 100_000_000, currency: "USD" }),
    ).toMatch(/99,999,999/);
  });
});

describe("webhook verification", () => {
  it("verifies the signature over the raw bytes and normalizes the event", async () => {
    const payload = event("checkout.session.completed", {
      id: "cs_test_1",
      object: "checkout.session",
    });

    await expect(
      provider().webhooks.verify(await signed(payload)),
    ).resolves.toEqual({
      id: "evt_checkout_session_completed",
      scope: "test",
      target: { id: "cs_test_1", kind: "checkout" },
      type: "checkout.session.completed",
    });
  });

  it("rejects a body that differs from the signed bytes by one character", async () => {
    const payload = event("checkout.session.completed", { id: "cs_test_1" });
    const request = await signed(payload);
    const tampered = new TextEncoder().encode(
      payload.replace("cs_test_1", "cs_test_2"),
    );

    await expect(
      provider().webhooks.verify({ ...request, body: tampered }),
    ).rejects.toThrow(
      expect.objectContaining({ name: "PaymentWebhookSignatureError" }),
    );
  });

  it("rejects a re-serialized body with the same JSON content", async () => {
    // Parsing and stringifying again changes whitespace - which is why the
    // route must hand over the bytes that arrived, not `c.req.json()`.
    const payload = event("checkout.session.completed", { id: "cs_test_1" });
    const request = await signed(payload);
    const reformatted = new TextEncoder().encode(
      JSON.stringify(JSON.parse(payload), null, 2),
    );

    await expect(
      provider().webhooks.verify({ ...request, body: reformatted }),
    ).rejects.toThrow(
      expect.objectContaining({ name: "PaymentWebhookSignatureError" }),
    );
  });

  it("rejects a signature made with another endpoint's secret", async () => {
    const payload = event("invoice.paid", { id: "in_1" });

    await expect(
      provider().webhooks.verify(await signed(payload, "whsec_other")),
    ).rejects.toThrow(
      expect.objectContaining({ name: "PaymentWebhookSignatureError" }),
    );
  });

  it("rejects a request with no signature header", async () => {
    await expect(
      provider().webhooks.verify({
        body: new TextEncoder().encode("{}"),
        headers: new Headers(),
      }),
    ).rejects.toThrow(/no Stripe-Signature header/);
  });

  it.each([
    [
      "invoice.paid",
      { id: "in_1" },
      { id: "in_1", kind: "invoice", signal: "paid" },
    ],
    [
      "invoice.payment_failed",
      { id: "in_1" },
      { id: "in_1", kind: "invoice", signal: "payment_failed" },
    ],
    [
      "invoice.payment_action_required",
      { id: "in_1" },
      { id: "in_1", kind: "invoice", signal: "action_required" },
    ],
    [
      "customer.subscription.updated",
      { id: "sub_1" },
      { id: "sub_1", kind: "subscription" },
    ],
    [
      "charge.refunded",
      { id: "ch_1", payment_intent: "pi_1" },
      { id: "pi_1", kind: "payment" },
    ],
    [
      "refund.updated",
      { id: "re_1", payment_intent: "pi_1" },
      { id: "pi_1", kind: "payment" },
    ],
    [
      "charge.dispute.created",
      { id: "dp_1", payment_intent: "pi_1" },
      { id: "pi_1", kind: "payment" },
    ],
  ])("routes %s to the object it concerns", async (type, object, target) => {
    const verified = await provider().webhooks.verify(
      await signed(event(type, object)),
    );

    expect(verified.target).toEqual(target);
  });

  it("acknowledges event types it does not use without a target", async () => {
    const verified = await provider().webhooks.verify(
      await signed(event("customer.created", { id: "cus_1" })),
    );

    expect(verified.target).toBeNull();
  });

  it("documents a subscription list in which every event has a target", () => {
    expect(STRIPE_WEBHOOK_EVENTS).toContain(
      "checkout.session.async_payment_succeeded",
    );
    expect(new Set(STRIPE_WEBHOOK_EVENTS).size).toBe(
      STRIPE_WEBHOOK_EVENTS.length,
    );
  });
});

describe("hosted checkout", () => {
  const session = {
    amount_total: 1900,
    client_reference_id: "purchase-1",
    currency: "pln",
    customer: "cus_1",
    expires_at: 1_790_003_600,
    id: "cs_test_1",
    metadata: {},
    object: "checkout.session",
    payment_intent: null,
    payment_status: "unpaid",
    status: "open",
    subscription: null,
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
  };

  it("sends the server-derived price, reference and idempotency key", async () => {
    const { client, requests } = fakeStripe(() => ({ body: session }));

    const checkout = await provider(client).checkout.create(
      {
        cancelUrl: "http://localhost:3000/example/payments?purchase=purchase-1",
        customerId: "cus_1",
        expiresAt: new Date(1_790_003_600_000),
        item: { amount: 1900, currency: "PLN", name: "Lifetime supporter" },
        metadata: { vitnode_offer: "@vitnode/example:lifetime" },
        mode: "one_time",
        reference: "purchase-1",
        successUrl:
          "http://localhost:3000/example/payments?purchase=purchase-1",
      },
      { idempotencyKey: "vitnode-checkout-1" },
    );

    const params = new URLSearchParams(requests[0].body);
    expect(requests[0].url).toContain("/v1/checkout/sessions");
    expect(requests[0].headers["idempotency-key"]).toBe("vitnode-checkout-1");
    expect(requests[0].headers["stripe-version"]).toBe(STRIPE_API_VERSION);
    expect(params.get("mode")).toBe("payment");
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("1900");
    expect(params.get("line_items[0][price_data][currency]")).toBe("pln");
    expect(params.get("client_reference_id")).toBe("purchase-1");
    expect(params.get("payment_intent_data[metadata][vitnode_reference]")).toBe(
      "purchase-1",
    );
    expect(params.get("expires_at")).toBe("1790003600");
    expect(checkout).toMatchObject({
      currency: "PLN",
      id: "cs_test_1",
      reference: "purchase-1",
      status: "open",
      url: session.url,
    });
  });

  it("asks for a recurring price for a subscription", async () => {
    const { client, requests } = fakeStripe(() => ({ body: session }));

    await provider(client).checkout.create(
      {
        cancelUrl: "http://localhost:3000/a",
        customerId: "cus_1",
        expiresAt: new Date(1_790_003_600_000),
        item: {
          amount: 19000,
          currency: "USD",
          interval: "year",
          name: "Plan",
        },
        metadata: {},
        mode: "subscription",
        reference: "purchase-2",
        successUrl: "http://localhost:3000/a",
      },
      { idempotencyKey: "k" },
    );

    const params = new URLSearchParams(requests[0].body);
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("line_items[0][price_data][recurring][interval]")).toBe(
      "year",
    );
    expect(params.get("subscription_data[metadata][vitnode_reference]")).toBe(
      "purchase-2",
    );
  });

  it("tells a declined delayed payment apart from one still processing", async () => {
    const completed = (intentStatus: string) =>
      fakeStripe(() => ({
        body: {
          ...session,
          payment_intent: {
            id: "pi_1",
            object: "payment_intent",
            status: intentStatus,
          },
          payment_status: "unpaid",
          status: "complete",
        },
      }));

    const processing = completed("processing");
    const declined = completed("requires_payment_method");

    await expect(
      provider(processing.client).checkout.retrieve("cs_test_1"),
    ).resolves.toMatchObject({ paymentId: "pi_1", paymentStatus: "unpaid" });
    await expect(
      provider(declined.client).checkout.retrieve("cs_test_1"),
    ).resolves.toMatchObject({ paymentStatus: "failed" });
    expect(declined.requests[0].url).toContain("expand[0]=payment_intent");
  });

  it("reports a Stripe outage as an uncertain result, not a failure", async () => {
    const { client } = fakeStripe(() => ({
      body: { error: { message: "Internal", type: "api_error" } },
      status: 500,
    }));

    const error: unknown = await provider(client)
      .checkout.retrieve("cs_test_1")
      .catch((caught: unknown) => caught);

    expect(isPaymentProviderError(error) && error.kind).toBe("uncertain");
  });

  it("reports a missing object as not found", async () => {
    const { client } = fakeStripe(() => ({
      body: {
        error: {
          code: "resource_missing",
          message: "No such checkout.session",
          type: "invalid_request_error",
        },
      },
      status: 404,
    }));

    const error: unknown = await provider(client)
      .checkout.retrieve("cs_missing")
      .catch((caught: unknown) => caught);

    expect(isPaymentProviderError(error) && error.kind).toBe("not_found");
  });
});

describe("subscriptions and invoices", () => {
  it("reads the period from the subscription item", async () => {
    const { client } = fakeStripe(() => ({
      body: {
        cancel_at: null,
        cancel_at_period_end: true,
        canceled_at: null,
        customer: "cus_1",
        ended_at: null,
        id: "sub_1",
        items: {
          data: [
            {
              current_period_end: 1_792_000_000,
              current_period_start: 1_789_000_000,
              price: {
                currency: "pln",
                id: "price_1",
                recurring: { interval: "month" },
                unit_amount: 1900,
              },
            },
          ],
        },
        latest_invoice: "in_1",
        metadata: { vitnode_reference: "purchase-1" },
        object: "subscription",
        status: "active",
      },
    }));

    await expect(
      provider(client).subscriptions?.retrieve("sub_1"),
    ).resolves.toMatchObject({
      amount: 1900,
      cancelAtPeriodEnd: true,
      currency: "PLN",
      currentPeriodEnd: new Date(1_792_000_000_000),
      interval: "month",
      priceId: "price_1",
      reference: "purchase-1",
      status: "active",
    });
  });

  it("reads an invoice's service period from its subscription line", async () => {
    const { client, requests } = fakeStripe(() => ({
      body: {
        amount_due: 1900,
        amount_paid: 1900,
        billing_reason: "subscription_cycle",
        currency: "pln",
        id: "in_1",
        lines: {
          data: [
            {
              parent: { subscription_item_details: { subscription: "sub_1" } },
              period: { end: 1_794_600_000, start: 1_792_000_000 },
              subscription: "sub_1",
            },
          ],
        },
        object: "invoice",
        parent: { subscription_details: { subscription: "sub_1" } },
        payments: {
          data: [{ payment: { payment_intent: "pi_9" }, status: "paid" }],
        },
        period_end: 1_792_000_000,
        period_start: 1_789_000_000,
        status: "paid",
        status_transitions: { paid_at: 1_792_000_100 },
      },
    }));

    await expect(
      provider(client).subscriptions?.retrieveInvoice("in_1"),
    ).resolves.toEqual({
      amountDue: 1900,
      amountPaid: 1900,
      billingReason: "subscription_cycle",
      currency: "PLN",
      id: "in_1",
      paidAt: new Date(1_792_000_100_000),
      paymentId: "pi_9",
      periodEnd: new Date(1_794_600_000_000),
      periodStart: new Date(1_792_000_000_000),
      providerStatus: "paid",
      status: "paid",
      subscriptionId: "sub_1",
    });
    expect(requests[0].url).toContain("expand[0]=payments");
  });
});

describe("refunds and disputes", () => {
  it("counts only succeeded refunds and keeps the original amount", async () => {
    const { client } = fakeStripe(request => {
      if (request.url.includes("/v1/payment_intents/")) {
        return {
          body: {
            amount: 1900,
            amount_received: 1900,
            currency: "pln",
            id: "pi_1",
            object: "payment_intent",
          },
        };
      }

      if (request.url.includes("/v1/refunds")) {
        return {
          body: {
            data: [
              {
                amount: 500,
                id: "re_1",
                object: "refund",
                status: "succeeded",
              },
              { amount: 300, id: "re_2", object: "refund", status: "pending" },
            ],
            has_more: false,
            object: "list",
          },
        };
      }

      return {
        body: {
          data: [
            {
              amount: 1900,
              id: "dp_1",
              object: "dispute",
              reason: "fraudulent",
              status: "needs_response",
            },
          ],
          has_more: false,
          object: "list",
        },
      };
    });

    await expect(provider(client).payments.retrieve("pi_1")).resolves.toEqual({
      amount: 1900,
      amountRefunded: 500,
      currency: "PLN",
      disputes: [
        {
          amount: 1900,
          id: "dp_1",
          providerStatus: "needs_response",
          reason: "fraudulent",
          status: "open",
        },
      ],
      id: "pi_1",
      refunds: [
        { amount: 500, id: "re_1", status: "succeeded" },
        { amount: 300, id: "re_2", status: "pending" },
      ],
    });
  });
});
