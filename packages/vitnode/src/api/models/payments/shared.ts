import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { createHash } from "node:crypto";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { VitNodeEventName, VitNodeEvents } from "@/api/models/events";
import type {
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";
import type { ResolvedPaymentsConfig } from "@/payments/config";
import type {
  PaymentPurchaseSnapshot,
  PaymentSubscriptionSnapshot,
  RegisteredPaymentOffer,
} from "@/payments/offer";
import type { PaymentProvider } from "@/payments/provider";

import { CONFIG } from "@/lib/config";
import { paymentOfferKey } from "@/payments/offer";
import { isPaymentProviderError } from "@/payments/provider";

export type PaymentsContext = Context<EnvVitNode>;
export type PurchaseRow = typeof core_payments_purchases.$inferSelect;
export type SubscriptionRow = typeof core_payments_subscriptions.$inferSelect;

/**
 * A problem retrying will not fix - an event for an object this install never
 * created, a provider that is no longer configured. Recorded for the AdminCP
 * and not retried by the queue.
 */
export class PaymentsPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentsPermanentError";
  }
}

export const isPermanentPaymentsError = (error: unknown): boolean =>
  (error instanceof Error && error.name === "PaymentsPermanentError") ||
  (isPaymentProviderError(error) && !error.retryable);

/** Errors as text for an admin: the message only - never a payload or a key. */
export const describePaymentsError = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

/**
 * An API error with a stable machine-readable `code` next to the human
 * `message` the shared `readApiErrorMessage` already shows.
 */
export const paymentsHttpError = (
  status: 400 | 401 | 403 | 404 | 409 | 502 | 503,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): HTTPException =>
  new HTTPException(status, {
    message,
    res: new Response(JSON.stringify({ code, message, ...extra }), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  });

export const requirePaymentsConfig = (
  c: PaymentsContext,
): ResolvedPaymentsConfig => {
  const config = c.get("core").payments.config;

  if (!config) {
    throw paymentsHttpError(
      503,
      "payments_disabled",
      "Payments are not enabled on this site.",
    );
  }

  return config;
};

export const requirePaymentsUser = (c: PaymentsContext) => {
  const user = c.get("user");
  if (!user) throw paymentsHttpError(401, "unauthorized", "Sign in first.");

  return user;
};

export const findRegisteredOffer = (
  c: PaymentsContext,
  pluginId: string,
  offerId: string,
): RegisteredPaymentOffer | undefined =>
  c.get("core").payments.offers.get(paymentOfferKey(pluginId, offerId));

/**
 * The provider a stored row belongs to. History stays readable without it,
 * but ongoing work for that row cannot continue - and says why.
 */
export const providerForRow = (
  c: PaymentsContext,
  row: { provider: string; providerScope: string },
): PaymentProvider => {
  const provider = c
    .get("core")
    .payments.config?.providers.find(item => item.id === row.provider);

  if (!provider) {
    throw new PaymentsPermanentError(
      `Payment provider "${row.provider}" is not configured any more. Register it in "payments.providers" again to finish this work - see the payments troubleshooting docs before uninstalling a provider with active subscriptions.`,
    );
  }

  if (provider.scope !== row.providerScope) {
    throw new PaymentsPermanentError(
      `This record belongs to the "${row.providerScope}" environment of "${row.provider}", but the configured keys are for "${provider.scope}".`,
    );
  }

  return provider;
};

/** A fixed-width hash of the resolved operation, for idempotency checks. */
export const hashCheckoutRequest = (parts: (null | string)[]): string =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

/**
 * An absolute URL on the configured web origin. The path always comes from
 * server-side declarations, so there is nothing to redirect elsewhere.
 */
export const webUrl = (
  path: string,
  params: Record<string, string> = {},
): string => {
  const url = new URL(path, CONFIG.web.origin);

  if (url.origin !== CONFIG.web.origin) {
    throw new Error(
      `Refusing to build a return URL outside ${CONFIG.web.origin}.`,
    );
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
};

export const purchaseSnapshot = (
  row: PurchaseRow,
): PaymentPurchaseSnapshot => ({
  amount: row.amount,
  currency: row.currency,
  fulfillmentStatus: row.fulfillmentStatus,
  id: row.publicId,
  interval: row.interval,
  offerId: row.offerId,
  offerName: row.offerName,
  paidAt: row.paidAt,
  pluginId: row.pluginId,
  refundedAmount: row.refundedAmount,
  refundStatus: row.refundStatus,
  userId: row.userId,
});

export const subscriptionSnapshot = (
  row: SubscriptionRow,
  purchase: Pick<PurchaseRow, "publicId">,
): PaymentSubscriptionSnapshot => ({
  amount: row.amount,
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  currency: row.currency,
  endedAt: row.endedAt,
  id: row.publicId,
  interval: row.interval,
  offerId: row.offerId,
  paidThrough: row.paidThrough,
  pluginId: row.pluginId,
  purchaseId: purchase.publicId,
  status: row.status,
  userId: row.userId,
});

/** Best effort: a failing listener never undoes a committed payment. */
export const emitPaymentsEvent = async <K extends VitNodeEventName>(
  c: PaymentsContext,
  name: K,
  payload: VitNodeEvents[K],
): Promise<void> => {
  try {
    await c.get("events").emit(name, payload, { pluginId: "@vitnode/core" });
  } catch (error) {
    await c
      .get("log")
      .warn(
        `[Payments] Event "${name}" was not delivered: ${describePaymentsError(error)}`,
      );
  }
};
