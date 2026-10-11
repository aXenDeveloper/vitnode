import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";

import type { PaymentOffer } from "@/payments/offer";
import type { PaymentProvider, ProviderCheckout } from "@/payments/provider";
import type { BillingInterval } from "@/payments/status";

import {
  core_payments_checkouts,
  core_payments_customers,
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";
import { CONFIG } from "@/lib/config";
import { findPaymentProvider, priceUnavailableReason } from "@/payments/config";
import { assertMinorUnits } from "@/payments/money";
import { offerPricesFor } from "@/payments/offer";
import { isPaymentProviderError } from "@/payments/provider";
import { TERMINAL_SUBSCRIPTION_STATUSES } from "@/payments/status";

import type { PaymentsContext, PurchaseRow } from "./shared";

import {
  describePaymentsError,
  emitPaymentsEvent,
  findRegisteredOffer,
  hashCheckoutRequest,
  paymentsHttpError,
  PaymentsPermanentError,
  providerForRow,
  requirePaymentsConfig,
  webUrl,
} from "./shared";
import { applyCheckoutState, refreshPurchase } from "./sync";

type CheckoutRow = typeof core_payments_checkouts.$inferSelect;

export interface CheckoutRequest {
  currency: string;
  /** Client-generated, scoped to the buyer. Same key + same request = same result. */
  idempotencyKey?: string;
  interval: BillingInterval | null;
  offerId: string;
  pluginId: string;
  /** Defaults to `payments.defaultProvider`. */
  provider?: string;
}

export interface CheckoutResult {
  checkoutUrl: null | string;
  purchase: PurchaseRow;
}

interface CheckoutUser {
  email: string;
  id: number;
  language: string;
  name: string;
}

/**
 * How long an attempt whose create call ended without an answer may still be
 * replayed with the same idempotency key. The replay sends the attempt's
 * original expiry, and Stripe refuses one less than 30 minutes away - so the
 * window is what is left of the checkout lifetime after those 30 minutes and a
 * margin, and never more than 20 minutes.
 */
const replayWindowMs = (checkoutExpiresInMinutes: number): number =>
  Math.max(0, Math.min(20, checkoutExpiresInMinutes - 35)) * 60_000;

/** An open checkout this close to expiring is not handed out again. */
const OPEN_CHECKOUT_MARGIN_MS = 2 * 60_000;

const resolveOfferName = async (
  c: PaymentsContext,
  offer: PaymentOffer,
  language: string,
): Promise<string> => {
  if (!offer.nameKey) return offer.name;

  try {
    const t = await c.get("i18n").getTranslator(language);
    // The key is a full path, so it is looked up from the root.
    const translated = t.has(offer.nameKey as never)
      ? t(offer.nameKey as never)
      : null;

    return typeof translated === "string" && translated.trim() !== ""
      ? translated.slice(0, 255)
      : offer.name;
  } catch {
    return offer.name;
  }
};

/**
 * The provider customer for a user, created once per provider and environment.
 * Concurrent first purchases converge on one customer: the provider call uses
 * an idempotency key derived from the user, and the insert loses gracefully.
 */
export const ensureBillingCustomer = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  user: CheckoutUser,
): Promise<string> => {
  const db = c.get("db");
  const where = and(
    eq(core_payments_customers.provider, provider.id),
    eq(core_payments_customers.providerScope, provider.scope),
    eq(core_payments_customers.userId, user.id),
  );
  const [existing] = await db
    .select({ externalId: core_payments_customers.externalId })
    .from(core_payments_customers)
    .where(where);

  if (existing) return existing.externalId;

  const { customerId } = await provider.customers.create(
    { email: user.email, name: user.name, userId: user.id },
    {
      // Per site, not just per user id: two installs sharing one Stripe account
      // must never be handed each other's customer by an idempotent replay.
      idempotencyKey: `vitnode-customer-${createHash("sha256")
        .update(CONFIG.web.origin)
        .digest("hex")
        .slice(0, 16)}-${provider.scope}-${user.id}`,
    },
  );

  await db
    .insert(core_payments_customers)
    .values({
      externalId: customerId,
      provider: provider.id,
      providerScope: provider.scope,
      userId: user.id,
    })
    .onConflictDoNothing();

  const [stored] = await db
    .select({ externalId: core_payments_customers.externalId })
    .from(core_payments_customers)
    .where(where);

  if (!stored) {
    throw new PaymentsPermanentError(
      `Provider customer ${customerId} is already linked to another account on this site.`,
    );
  }

  return stored.externalId;
};

const isUsableOpenCheckout = (checkout: CheckoutRow | undefined) =>
  checkout?.status === "open" &&
  !!checkout.url &&
  checkout.expiresAt.getTime() - Date.now() > OPEN_CHECKOUT_MARGIN_MS;

const latestCheckout = async (
  c: PaymentsContext,
  purchaseId: number,
): Promise<CheckoutRow | undefined> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_payments_checkouts)
    .where(eq(core_payments_checkouts.purchaseId, purchaseId))
    .orderBy(desc(core_payments_checkouts.id))
    .limit(1);

  return row;
};

/**
 * An open purchase whose checkout should already have expired is asked about
 * before a new checkout is refused because of it - an abandoned tab must not
 * lock the buyer out until reconciliation runs.
 */
const settleStaleOpenPurchase = async (
  c: PaymentsContext,
  userId: number,
  pluginId: string,
  offerId: string,
): Promise<void> => {
  const [open] = await c
    .get("db")
    .select()
    .from(core_payments_purchases)
    .where(
      and(
        eq(core_payments_purchases.userId, userId),
        eq(core_payments_purchases.pluginId, pluginId),
        eq(core_payments_purchases.offerId, offerId),
        eq(core_payments_purchases.paymentStatus, "awaiting_payment"),
      ),
    );

  if (!open) return;

  const checkout = await latestCheckout(c, open.id);
  if (!checkout || checkout.expiresAt.getTime() > Date.now()) return;

  try {
    const provider = providerForRow(c, open);

    if (checkout.externalId) {
      await refreshPurchase(c, provider, open);

      return;
    }
  } catch (error) {
    await c
      .get("log")
      .warn(
        `[Payments] Could not refresh purchase ${open.publicId}: ${describePaymentsError(error)}`,
      );

    return;
  }

  // No provider checkout was ever confirmed and the window has passed.
  await c
    .get("db")
    .update(core_payments_purchases)
    .set({ nextCheckAt: null, paymentStatus: "expired" })
    .where(
      and(
        eq(core_payments_purchases.id, open.id),
        eq(core_payments_purchases.paymentStatus, "awaiting_payment"),
      ),
    );
};

/**
 * Starts (or resumes) a hosted checkout for the signed-in buyer.
 *
 * The browser names only an offer, a currency, an interval and optionally a
 * provider. The price, the buyer, the customer, the return URLs and everything
 * stored come from the server. The purchase and its checkout attempt are
 * written - under a per-buyer-and-offer lock - before the provider is called,
 * and the provider is called outside any transaction with an idempotency key
 * stored on the attempt, so a timeout followed by a retry gets the same
 * checkout back instead of a second one.
 */
export const startCheckout = async (
  c: PaymentsContext,
  user: CheckoutUser,
  request: CheckoutRequest,
): Promise<CheckoutResult> => {
  const config = requirePaymentsConfig(c);
  const registered = findRegisteredOffer(c, request.pluginId, request.offerId);

  if (!registered) {
    throw paymentsHttpError(
      404,
      "offer_not_found",
      "This offer does not exist.",
    );
  }

  const { offer, pluginId } = registered;
  const provider = findPaymentProvider(config, request.provider);

  if (!provider) {
    throw paymentsHttpError(
      400,
      "provider_unavailable",
      "That payment provider is not available.",
    );
  }

  const prices = offerPricesFor(offer, request.interval);

  if (!prices) {
    throw paymentsHttpError(
      400,
      "interval_unavailable",
      offer.mode === "subscription"
        ? "Choose a billing interval this plan offers."
        : "A one-time offer has no billing interval.",
    );
  }

  const amount = prices[request.currency];

  if (amount === undefined) {
    throw paymentsHttpError(
      400,
      "currency_unavailable",
      `This offer has no price in ${request.currency}.`,
    );
  }

  const money = {
    amount: assertMinorUnits(amount, { positive: true }),
    currency: request.currency,
  };
  const unavailable = priceUnavailableReason(config, provider, offer, money);

  if (unavailable) {
    throw paymentsHttpError(400, "currency_unavailable", unavailable);
  }

  const requestHash = hashCheckoutRequest([
    pluginId,
    offer.id,
    money.currency,
    request.interval,
    provider.id,
    provider.scope,
  ]);

  await settleStaleOpenPurchase(c, user.id, pluginId, offer.id);

  const offerName = await resolveOfferName(c, offer, user.language);
  let created = false;

  const decision = await c.get("db").transaction(async tx => {
    // One checkout decision at a time per buyer and offer: the eligibility
    // read and the insert below cannot interleave with another click.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`payments:${user.id}:${pluginId}:${offer.id}`}))`,
    );

    if (request.idempotencyKey) {
      const [previous] = await tx
        .select()
        .from(core_payments_purchases)
        .where(
          and(
            eq(core_payments_purchases.userId, user.id),
            eq(core_payments_purchases.idempotencyKey, request.idempotencyKey),
          ),
        );

      if (previous) {
        if (previous.requestHash !== requestHash) {
          throw paymentsHttpError(
            409,
            "idempotency_conflict",
            "This idempotency key was already used for a different checkout.",
          );
        }

        return previous;
      }
    }

    const [open] = await tx
      .select()
      .from(core_payments_purchases)
      .where(
        and(
          eq(core_payments_purchases.userId, user.id),
          eq(core_payments_purchases.pluginId, pluginId),
          eq(core_payments_purchases.offerId, offer.id),
          inArray(core_payments_purchases.paymentStatus, [
            "awaiting_payment",
            "processing",
          ]),
        ),
      );

    if (open) {
      if (open.paymentStatus === "processing") {
        throw paymentsHttpError(
          409,
          "payment_processing",
          "A payment for this offer is still being processed.",
          { purchaseId: open.publicId },
        );
      }

      // The same request again - a double click or a second tab.
      if (open.requestHash === requestHash) return open;

      throw paymentsHttpError(
        409,
        "checkout_in_progress",
        "You already have an unfinished checkout for this offer. Continue it or cancel it first.",
        { purchaseId: open.publicId },
      );
    }

    if (offer.mode === "subscription") {
      const [live] = await tx
        .select({ id: core_payments_subscriptions.id })
        .from(core_payments_subscriptions)
        .where(
          and(
            eq(core_payments_subscriptions.userId, user.id),
            eq(core_payments_subscriptions.pluginId, pluginId),
            eq(core_payments_subscriptions.offerId, offer.id),
            notInArray(core_payments_subscriptions.status, [
              ...TERMINAL_SUBSCRIPTION_STATUSES,
            ]),
          ),
        )
        .limit(1);

      if (live) {
        throw paymentsHttpError(
          409,
          "already_subscribed",
          "You already have a subscription to this plan. Manage it from your billing settings.",
        );
      }
    }

    const eligibility = (await offer.isEligible?.({
      c,
      interval: request.interval,
      tx,
      userId: user.id,
    })) ?? { eligible: true };

    if (!eligibility.eligible) {
      throw paymentsHttpError(409, "not_eligible", eligibility.reason);
    }

    const expiresAt = new Date(
      Date.now() + config.checkoutExpiresInMinutes * 60_000,
    );
    const [purchase] = await tx
      .insert(core_payments_purchases)
      .values({
        amount: money.amount,
        currency: money.currency,
        idempotencyKey: request.idempotencyKey ?? null,
        interval: request.interval,
        mode: offer.mode,
        // Checked again after the checkout window, in case nothing reports back.
        nextCheckAt: new Date(expiresAt.getTime() + 5 * 60_000),
        offerId: offer.id,
        offerName,
        pluginId,
        provider: provider.id,
        providerScope: provider.scope,
        requestHash,
        userId: user.id,
      })
      .returning();

    created = true;

    return purchase;
  });

  if (created) {
    await emitPaymentsEvent(c, "payments.purchase.created", {
      offerId: decision.offerId,
      pluginId: decision.pluginId,
      purchaseId: decision.publicId,
      userId: user.id,
    });
  }

  return await openCheckout(c, provider, offer, user, decision);
};

/** Picks the attempt to (re)use, under a row lock so concurrent retries agree. */
const claimAttempt = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  purchase: PurchaseRow,
): Promise<
  | { attempt: CheckoutRow; reuse: boolean }
  | { supersede: CheckoutRow }
  | { url: string }
> => {
  const config = requirePaymentsConfig(c);

  return await c.get("db").transaction(async tx => {
    await tx
      .select({ id: core_payments_purchases.id })
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchase.id))
      .for("update");

    const [latest] = await tx
      .select()
      .from(core_payments_checkouts)
      .where(eq(core_payments_checkouts.purchaseId, purchase.id))
      .orderBy(desc(core_payments_checkouts.id))
      .limit(1);

    if (latest && isUsableOpenCheckout(latest) && latest.url) {
      return { url: latest.url };
    }

    // About to expire but still payable: it is closed at the provider before
    // a new one exists, so the buyer can never pay both.
    if (latest?.status === "open" && latest.externalId) {
      return { supersede: latest };
    }

    if (
      latest &&
      (latest.status === "creating" || latest.status === "unknown") &&
      Date.now() - latest.createdAt.getTime() <
        replayWindowMs(config.checkoutExpiresInMinutes)
    ) {
      return { attempt: latest, reuse: true };
    }

    if (
      latest &&
      (latest.status === "creating" || latest.status === "unknown")
    ) {
      await tx
        .update(core_payments_checkouts)
        .set({
          lastError: "Abandoned: the provider never confirmed this checkout.",
          status: "failed",
        })
        .where(eq(core_payments_checkouts.id, latest.id));
    }

    const [attempt] = await tx
      .insert(core_payments_checkouts)
      .values({
        expiresAt: new Date(
          Date.now() + config.checkoutExpiresInMinutes * 60_000,
        ),
        idempotencyKey: `vitnode-checkout-${randomUUID()}`,
        provider: provider.id,
        providerScope: provider.scope,
        purchaseId: purchase.id,
      })
      .returning();

    return { attempt, reuse: false };
  });
};

const openCheckout = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  offer: PaymentOffer,
  user: CheckoutUser,
  purchase: PurchaseRow,
): Promise<CheckoutResult> => {
  if (purchase.paymentStatus !== "awaiting_payment") {
    return { checkoutUrl: null, purchase };
  }

  const db = c.get("db");
  let claimed = await claimAttempt(c, provider, purchase);
  if ("url" in claimed) return { checkoutUrl: claimed.url, purchase };

  if ("supersede" in claimed) {
    const previous = claimed.supersede;
    let state: ProviderCheckout;

    try {
      state = await provider.checkout.expire(previous.externalId ?? "");
    } catch (error) {
      if (isPaymentProviderError(error) && error.kind === "rejected") {
        // Usually "already complete" - whatever happened there wins.
        return {
          checkoutUrl: null,
          purchase: await refreshPurchase(c, provider, purchase),
        };
      }

      throw error;
    }

    if (state.status === "complete") {
      const applied = await applyCheckoutState(c, provider, state);

      return { checkoutUrl: null, purchase: applied.purchase };
    }

    await db
      .update(core_payments_checkouts)
      .set({ status: "expired", url: null })
      .where(eq(core_payments_checkouts.id, previous.id));

    claimed = await claimAttempt(c, provider, purchase);
    if ("url" in claimed) return { checkoutUrl: claimed.url, purchase };
    if ("supersede" in claimed) {
      throw paymentsHttpError(
        409,
        "checkout_in_progress",
        "Another checkout for this purchase is being prepared. Try again in a moment.",
        { purchaseId: purchase.publicId },
      );
    }
  }

  const { attempt } = claimed;
  const returnParams = { purchase: purchase.publicId };
  let checkout: ProviderCheckout;

  try {
    const customerId = await ensureBillingCustomer(c, provider, user);

    checkout = await provider.checkout.create(
      {
        cancelUrl: webUrl(offer.returnPath, {
          ...returnParams,
          checkout: "canceled",
        }),
        customerId,
        expiresAt: attempt.expiresAt,
        item: {
          amount: purchase.amount,
          currency: purchase.currency,
          interval: purchase.interval ?? undefined,
          name: purchase.offerName,
        },
        locale: user.language,
        metadata: {
          vitnode_offer: `${purchase.pluginId}:${purchase.offerId}`,
          vitnode_user_id: String(user.id),
        },
        mode: purchase.mode,
        reference: purchase.publicId,
        successUrl: webUrl(offer.returnPath, returnParams),
      },
      { idempotencyKey: attempt.idempotencyKey },
    );
  } catch (error) {
    const message = describePaymentsError(error);
    const uncertain = !isPaymentProviderError(error) || error.retryable;

    await db
      .update(core_payments_checkouts)
      .set({ lastError: message, status: uncertain ? "unknown" : "failed" })
      .where(
        and(
          eq(core_payments_checkouts.id, attempt.id),
          inArray(core_payments_checkouts.status, ["creating", "unknown"]),
        ),
      );

    await c
      .get("log")
      .warn(`[Payments] Checkout for ${purchase.publicId} failed: ${message}`);

    if (uncertain) {
      throw paymentsHttpError(
        503,
        "checkout_uncertain",
        "The payment provider did not answer. Try again - you will not be charged twice.",
        { purchaseId: purchase.publicId },
      );
    }

    throw paymentsHttpError(
      502,
      "checkout_failed",
      "The payment provider could not start this checkout.",
      { purchaseId: purchase.publicId },
    );
  }

  await db
    .update(core_payments_checkouts)
    .set({
      expiresAt: checkout.expiresAt ?? attempt.expiresAt,
      externalId: checkout.id,
      lastError: null,
      status: checkout.status,
      url: checkout.url,
    })
    .where(eq(core_payments_checkouts.id, attempt.id));

  await db
    .update(core_payments_purchases)
    .set({ externalCustomerId: checkout.customerId })
    .where(eq(core_payments_purchases.id, purchase.id));

  if (checkout.status !== "open") {
    // A replayed create can return a checkout that already finished.
    const applied = await applyCheckoutState(c, provider, checkout);

    return { checkoutUrl: null, purchase: applied.purchase };
  }

  return { checkoutUrl: checkout.url, purchase };
};

/**
 * Cancels the buyer's own unfinished purchase so they can start over (for
 * example in another currency). The provider checkout is expired first; if it
 * turns out to have been paid in the meantime, that wins.
 */
export const cancelPurchase = async (
  c: PaymentsContext,
  purchase: PurchaseRow,
): Promise<PurchaseRow> => {
  if (purchase.paymentStatus !== "awaiting_payment") {
    throw paymentsHttpError(
      409,
      "not_cancelable",
      "Only a checkout that has not been paid can be canceled.",
    );
  }

  const provider = providerForRow(c, purchase);
  const checkout = await latestCheckout(c, purchase.id);

  if (checkout?.externalId && checkout.status === "open") {
    try {
      const state = await provider.checkout.expire(checkout.externalId);
      const applied = await applyCheckoutState(c, provider, state);

      if (applied.purchase.paymentStatus !== "expired") return applied.purchase;
    } catch (error) {
      if (isPaymentProviderError(error) && error.kind === "rejected") {
        // Usually "already complete": read what really happened.
        return await refreshPurchase(c, provider, purchase);
      }

      throw error;
    }
  }

  const [canceled] = await c
    .get("db")
    .update(core_payments_purchases)
    .set({ nextCheckAt: null, paymentStatus: "canceled" })
    .where(
      and(
        eq(core_payments_purchases.id, purchase.id),
        inArray(core_payments_purchases.paymentStatus, [
          "awaiting_payment",
          "expired",
        ]),
      ),
    )
    .returning();

  return canceled ?? purchase;
};

/**
 * A Customer Portal session for the signed-in user's own billing account. The
 * customer comes from the stored mapping, never from the request.
 */
export const createPortalSession = async (
  c: PaymentsContext,
  userId: number,
  { providerId, returnPath }: { providerId?: string; returnPath: string },
): Promise<string> => {
  const config = requirePaymentsConfig(c);
  const provider = findPaymentProvider(config, providerId);

  if (!provider?.portal) {
    throw paymentsHttpError(
      400,
      "portal_unavailable",
      "Billing management is not available for this provider.",
    );
  }

  const [customer] = await c
    .get("db")
    .select({ externalId: core_payments_customers.externalId })
    .from(core_payments_customers)
    .where(
      and(
        eq(core_payments_customers.provider, provider.id),
        eq(core_payments_customers.providerScope, provider.scope),
        eq(core_payments_customers.userId, userId),
      ),
    );

  if (!customer) {
    throw paymentsHttpError(
      404,
      "no_billing_account",
      "You have no billing account yet. It is created with your first purchase.",
    );
  }

  const { url } = await provider.portal.createSession({
    customerId: customer.externalId,
    returnUrl: webUrl(returnPath),
  });

  return url;
};
