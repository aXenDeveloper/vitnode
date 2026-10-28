import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  PaymentCheckoutState,
  PaymentProviderApiPlugin,
} from "@/api/lib/payments/provider";

import {
  PaymentProviderError,
  PaymentWebhookVerificationError,
} from "@/api/lib/payments/errors";

const SIGNATURE_HEADER = "x-vitnode-fake-signature";
const TOLERANCE_SECONDS = 300;

interface FakeCheckout extends PaymentCheckoutState {
  url: string;
}

type FakeOutcome = "expired" | "failed" | "processing" | "succeeded";

/** A signed webhook request, ready to `POST` to the instance's webhook URL. */
export interface FakePaymentWebhook {
  body: string;
  headers: Record<string, string>;
}

/** The fake provider plus the controls a test drives it with. */
export interface FakePaymentAdapter extends PaymentProviderApiPlugin {
  /** Every checkout created so far, by checkout id. */
  readonly checkouts: ReadonlyMap<string, Readonly<FakeCheckout>>;
  /**
   * Moves a checkout to `outcome` and returns the signed webhook that reports
   * it. `eventId` defaults to a fresh one; pass the same id to simulate a
   * redelivery.
   */
  settle: (
    checkoutId: string,
    outcome: FakeOutcome,
    options?: { amount?: number; eventId?: string },
  ) => FakePaymentWebhook;
  /** While `true`, every provider call throws an `unavailable` error, like an outage. */
  setUnavailable: (unavailable: boolean) => void;
  /** Signs any body with the instance's secret - for tampering tests. */
  sign: (body: string, timestamp?: number) => FakePaymentWebhook;
}

/**
 * An in-memory payment provider for automated tests and local experiments with
 * several provider instances. It moves no money and has no hosted page: its
 * checkout URL is the success URL, and outcomes happen only when a test calls
 * `settle()` and posts the returned webhook.
 *
 * Never configure it in production: it refuses to start when
 * `NODE_ENV=production`. State lives in the process and is lost on restart.
 *
 * @example
 * ```ts
 * import { FakePaymentAdapter } from "@vitnode/core/api/adapters/payments/fake";
 *
 * const fake = FakePaymentAdapter({ id: "fake-test", webhookSecret: "test-secret" });
 * // buildApiConfig({ payments: { providers: [fake] }, ... })
 * ```
 */
export const FakePaymentAdapter = ({
  id,
  name = "Test provider",
  webhookSecret,
}: {
  id: string;
  name?: string;
  /** Signs and verifies the fake webhooks. Any non-empty string. */
  webhookSecret: string;
}): FakePaymentAdapter => {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[VitNode payments] FakePaymentAdapter "${id}" is for tests and development only; remove it from \`payments.providers\` in production.`,
    );
  }
  if (!webhookSecret) {
    throw new Error(
      `[VitNode payments] FakePaymentAdapter "${id}" needs a webhookSecret.`,
    );
  }

  const checkouts = new Map<string, FakeCheckout>();
  let unavailable = false;

  const assertAvailable = () => {
    if (unavailable) {
      throw new PaymentProviderError({
        code: "fake_unavailable",
        kind: "unavailable",
        message: "The fake provider is switched to unavailable.",
      });
    }
  };

  const signatureOf = (timestamp: number, body: string) =>
    createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

  const sign = (body: string, timestamp = Math.floor(Date.now() / 1000)) => ({
    body,
    headers: {
      "content-type": "application/json",
      [SIGNATURE_HEADER]: `t=${timestamp},v1=${signatureOf(timestamp, body)}`,
    },
  });

  const find = (checkoutId: string): FakeCheckout => {
    const checkout = checkouts.get(checkoutId);
    if (!checkout) {
      throw new PaymentProviderError({
        code: "checkout_not_found",
        kind: "rejected",
        message: `No fake checkout ${checkoutId}.`,
      });
    }

    return checkout;
  };

  return {
    id,
    name,
    type: "fake",
    checkouts,

    createCheckout: async args =>
      Promise.resolve().then(() => {
        assertAvailable();
        // Idempotent like a real provider: the same key returns the same checkout.
        const checkoutId = `fake_cs_${createHash("sha256")
          .update(`${id}:${args.idempotencyKey}`)
          .digest("hex")
          .slice(0, 24)}`;
        const existing = checkouts.get(checkoutId);
        if (existing) return { ...existing };

        const checkout: FakeCheckout = {
          amount: args.amount,
          checkoutId,
          currency: args.currency,
          expiresAt: args.expiresAt,
          livemode: false,
          paymentId: args.paymentId,
          providerStatus: "open",
          status: "pending",
          url: args.successUrl,
        };
        checkouts.set(checkoutId, checkout);

        return { ...checkout };
      }),

    retrieveCheckout: async checkoutId =>
      Promise.resolve().then(() => {
        assertAvailable();

        return { ...find(checkoutId) };
      }),

    expireCheckout: async checkoutId =>
      Promise.resolve().then(() => {
        assertAvailable();
        const checkout = find(checkoutId);
        if (checkout.status === "pending") {
          checkout.status = "expired";
          checkout.providerStatus = "expired";
        }

        return { ...checkout };
      }),

    verifyWebhook: async ({ body, headers }) =>
      Promise.resolve().then(() => {
        const header = headers.get(SIGNATURE_HEADER) ?? "";
        const parts = Object.fromEntries(
          header.split(",").map(part => part.split("=", 2) as [string, string]),
        );
        const timestamp = Number(parts.t);
        const text = new TextDecoder().decode(body);
        const expected = Buffer.from(signatureOf(timestamp, text));
        const received = Buffer.from(parts.v1 ?? "");

        if (
          !Number.isSafeInteger(timestamp) ||
          Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS ||
          expected.length !== received.length ||
          !timingSafeEqual(expected, received)
        ) {
          throw new PaymentWebhookVerificationError(
            "Fake webhook signature does not match.",
          );
        }

        const event = JSON.parse(text) as {
          checkout?: PaymentCheckoutState;
          id: string;
          type: string;
        };
        if (!event.checkout) {
          return {
            eventId: event.id,
            kind: "ignored" as const,
            type: event.type,
          };
        }

        return {
          checkout: event.checkout,
          eventId: event.id,
          kind: "checkout" as const,
          type: event.type,
        };
      }),

    settle: (checkoutId, outcome, options = {}) => {
      const checkout = find(checkoutId);
      checkout.status = outcome;
      checkout.providerStatus = outcome;

      return sign(
        JSON.stringify({
          id:
            options.eventId ??
            `fake_evt_${createHash("sha256")
              .update(`${checkoutId}:${outcome}:${Math.random()}`)
              .digest("hex")
              .slice(0, 24)}`,
          type: `checkout.${outcome}`,
          checkout: {
            ...checkout,
            amount: options.amount ?? checkout.amount,
          },
        }),
      );
    },

    setUnavailable: value => {
      unavailable = value;
    },

    sign,
  };
};
