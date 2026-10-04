import type { Context } from "hono";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import type {
  BillingInterval,
  FulfillmentStatus,
  RefundStatus,
  SubscriptionStatus,
} from "./status";

import { assertCurrencyCode, assertMinorUnits } from "./money";
import { PaymentsConfigError } from "./provider";
import { BILLING_INTERVALS } from "./status";

/** The transaction a payment handler writes through. Roll it back by throwing. */
export type PaymentsTransaction = Omit<EnvVitNode["Variables"]["db"], "$client">;

/** Explicit prices, one per currency code, in minor units. No conversion. */
export type OfferPrices = Readonly<Record<string, number>>;

export type PaymentOfferEligibility =
  | { eligible: false; reason: string }
  | { eligible: true };

interface PaymentOfferEligibilityArgs {
  c: Context<EnvVitNode>;
  interval: BillingInterval | null;
  /** Reads inside the checkout's lock, so two clicks cannot both pass. */
  tx: PaymentsTransaction;
  userId: number;
}

/** What a purchase looked like when it was bought. Never the live offer. */
export interface PaymentPurchaseSnapshot {
  amount: number;
  currency: string;
  fulfillmentStatus: FulfillmentStatus;
  id: string;
  interval: BillingInterval | null;
  offerId: string;
  offerName: string;
  paidAt: Date | null;
  pluginId: string;
  refundedAmount: number;
  refundStatus: RefundStatus;
  userId: null | number;
}

export interface PaymentSubscriptionSnapshot {
  amount: number;
  cancelAtPeriodEnd: boolean;
  currency: string;
  endedAt: Date | null;
  id: string;
  interval: BillingInterval;
  offerId: string;
  /** End of the last period a verified payment covers. `null` before the first. */
  paidThrough: Date | null;
  pluginId: string;
  purchaseId: string;
  status: SubscriptionStatus;
  userId: null | number;
}

interface PaymentHandlerArgs {
  c: Context<EnvVitNode>;
  /**
   * Write the business effect through this. It commits together with the
   * fulfillment record, so a retried job never grants twice; throw to roll back
   * and let the queue try again.
   */
  tx: PaymentsTransaction;
}

interface PaymentOfferBase {
  /** Stable within the plugin - stored on every purchase. Never rename it. */
  id: string;
  /**
   * Server-side gate run before every checkout, e.g. "already owns it". The
   * browser can never skip it.
   */
  isEligible?: (
    args: PaymentOfferEligibilityArgs,
  ) => PaymentOfferEligibility | Promise<PaymentOfferEligibility>;
  /** Snapshot name stored on purchases and shown on the hosted checkout page. */
  name: string;
  /**
   * A message key (full path, e.g. `@vitnode/example.payments.offers.lifetime.name`)
   * used instead of `name` for the buyer's language when the API has it.
   */
  nameKey?: string;
  /**
   * Where the buyer lands after checkout - a path in this app such as
   * `/example/payments`. Never taken from the browser.
   */
  returnPath: string;
}

export interface OneTimePaymentOffer extends PaymentOfferBase {
  mode: "one_time";
  /** Grant what was bought. Runs once per paid purchase, after verification. */
  onPaid: (
    args: PaymentHandlerArgs & { purchase: PaymentPurchaseSnapshot },
  ) => Promise<void>;
  /**
   * Called once per refund the provider confirms, partial or full. Core only
   * reports it - what it means for access is the plugin's decision.
   */
  onRefunded?: (
    args: PaymentHandlerArgs & {
      purchase: PaymentPurchaseSnapshot;
      refund: { amount: number; id: string };
    },
  ) => Promise<void>;
  prices: OfferPrices;
}

export interface SubscriptionPaymentOffer extends PaymentOfferBase {
  /** Prices per billing interval. Only `month` and `year` are supported. */
  intervals: Partial<Record<BillingInterval, OfferPrices>>;
  mode: "subscription";
  /**
   * Called whenever the local subscription record changed - payment, renewal,
   * failed renewal, scheduled cancellation, end. Set access from the snapshot
   * (for example to `paidThrough`); never add to it, because the same state can
   * arrive more than once.
   */
  onSubscriptionChanged: (
    args: PaymentHandlerArgs & { subscription: PaymentSubscriptionSnapshot },
  ) => Promise<void>;
}

export type PaymentOffer = OneTimePaymentOffer | SubscriptionPaymentOffer;

export interface RegisteredPaymentOffer {
  offer: PaymentOffer;
  pluginId: string;
}

const OFFER_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const paymentOfferKey = (pluginId: string, offerId: string): string =>
  `${pluginId}:${offerId}`;

/** A same-origin, absolute path - no scheme, no host, no protocol-relative trick. */
export const isSafeReturnPath = (path: string): boolean =>
  path.startsWith("/") &&
  !path.startsWith("//") &&
  !path.includes("\\") &&
  !/[\s\u0000-\u001f]/.test(path) &&
  !/^\/[^/]*:/.test(path);

const assertPrices = (prices: OfferPrices, where: string): void => {
  const entries = Object.entries(prices);

  if (entries.length === 0) {
    throw new PaymentsConfigError(`${where} declares no prices.`);
  }

  for (const [currency, amount] of entries) {
    try {
      assertCurrencyCode(currency);
      assertMinorUnits(amount, { positive: true });
    } catch (error) {
      throw new PaymentsConfigError(
        `${where}, price ${currency}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
};

/** Structural checks on one offer. Currency availability is checked at boot. */
export const validatePaymentOffer = (
  offer: PaymentOffer,
  pluginId: string,
): void => {
  const where = `Offer "${paymentOfferKey(pluginId, String(offer.id))}"`;

  if (typeof offer.id !== "string" || !OFFER_ID.test(offer.id)) {
    throw new PaymentsConfigError(
      `${where}: the id must be 1-63 lowercase letters, digits or dashes.`,
    );
  }

  if (typeof offer.name !== "string" || offer.name.trim() === "") {
    throw new PaymentsConfigError(`${where}: "name" is required.`);
  }

  if (typeof offer.returnPath !== "string" || !isSafeReturnPath(offer.returnPath)) {
    throw new PaymentsConfigError(
      `${where}: "returnPath" must be a path in this app, such as "/example/payments".`,
    );
  }

  const mode: unknown = offer.mode;

  if (mode === "one_time") {
    const oneTime = offer as OneTimePaymentOffer;
    assertPrices(oneTime.prices ?? {}, where);

    if (typeof oneTime.onPaid !== "function") {
      throw new PaymentsConfigError(
        `${where}: a one-time offer needs an "onPaid" handler to fulfill it.`,
      );
    }

    return;
  }

  if (mode === "subscription") {
    const subscription = offer as SubscriptionPaymentOffer;
    const intervals = Object.entries(subscription.intervals ?? {});

    if (intervals.length === 0) {
      throw new PaymentsConfigError(
        `${where}: a subscription offer needs prices for "month" and/or "year".`,
      );
    }

    for (const [interval, prices] of intervals) {
      if (!(BILLING_INTERVALS as readonly string[]).includes(interval)) {
        throw new PaymentsConfigError(
          `${where}: interval "${interval}" is not supported. Use "month" or "year".`,
        );
      }

      assertPrices(prices ?? {}, `${where} (${interval})`);
    }

    if (typeof subscription.onSubscriptionChanged !== "function") {
      throw new PaymentsConfigError(
        `${where}: a subscription offer needs an "onSubscriptionChanged" handler.`,
      );
    }

    return;
  }

  throw new PaymentsConfigError(
    `${where}: mode must be "one_time" or "subscription".`,
  );
};

/** Validates every offer and refuses two with the same plugin and id. */
export const validatePaymentOffers = (
  entries: readonly RegisteredPaymentOffer[],
): RegisteredPaymentOffer[] => {
  const seen = new Set<string>();

  for (const { offer, pluginId } of entries) {
    validatePaymentOffer(offer, pluginId);
    const key = paymentOfferKey(pluginId, offer.id);

    if (seen.has(key)) {
      throw new PaymentsConfigError(
        `Offer "${key}" is registered twice. Offer ids must be unique within a plugin.`,
      );
    }

    seen.add(key);
  }

  return [...entries];
};

/** Declares an offer a plugin sells. Validated when the plugin is built. */
export const definePaymentOffer = <const T extends PaymentOffer>(offer: T): T =>
  offer;

/** The price list one offer charges for an interval (`null` for one-time). */
export const offerPricesFor = (
  offer: PaymentOffer,
  interval: BillingInterval | null,
): OfferPrices | undefined =>
  offer.mode === "one_time"
    ? interval === null
      ? offer.prices
      : undefined
    : interval === null
      ? undefined
      : offer.intervals[interval];
