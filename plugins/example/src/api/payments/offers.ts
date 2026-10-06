import { definePaymentOffer } from "@vitnode/core/payments";
import { and, eq, isNull } from "drizzle-orm";

import { example_payments_access } from "@/database/payments";

import {
  hasActiveAccess,
  shouldRevokeAfterRefund,
  subscriptionAccessUntil,
} from "./policy";

export const EXAMPLE_RETURN_PATH = "/example/payments";

/** Bought once, kept until a full refund. */
export const lifetimePassOffer = definePaymentOffer({
  id: "lifetime-pass",
  mode: "one_time",
  name: "Example lifetime pass",
  nameKey: "@vitnode/example.payments.offers.lifetime-pass.name",
  returnPath: EXAMPLE_RETURN_PATH,
  // Explicit prices per currency. No exchange rates: each one is a decision.
  prices: { EUR: 1199, PLN: 4900, USD: 1299 },

  // Runs inside the checkout lock, so two tabs cannot both pass it.
  isEligible: async ({ tx, userId }) => {
    const [grant] = await tx
      .select()
      .from(example_payments_access)
      .where(
        and(
          eq(example_payments_access.userId, userId),
          eq(example_payments_access.offerId, "lifetime-pass"),
        ),
      );

    return hasActiveAccess(grant)
      ? { eligible: false, reason: "You already own the lifetime pass." }
      : { eligible: true };
  },

  // Idempotent by construction: one row per user and offer. A retry, or a
  // repurchase after a refund, lands on the same row.
  onPaid: async ({ purchase, tx }) => {
    if (purchase.userId === null) return;

    await tx
      .insert(example_payments_access)
      .values({
        accessUntil: null,
        offerId: purchase.offerId,
        purchaseId: purchase.id,
        userId: purchase.userId,
      })
      .onConflictDoUpdate({
        set: { accessUntil: null, purchaseId: purchase.id, revokedAt: null },
        target: [
          example_payments_access.userId,
          example_payments_access.offerId,
        ],
      });
  },

  onRefunded: async ({ purchase, tx }) => {
    if (!shouldRevokeAfterRefund(purchase)) return;

    // Only the grant this purchase created - never one a later purchase made.
    await tx
      .update(example_payments_access)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(example_payments_access.purchaseId, purchase.id),
          isNull(example_payments_access.revokedAt),
        ),
      );
  },
});

/** Monthly or yearly, renewed automatically until cancelled. */
export const proPlanOffer = definePaymentOffer({
  id: "pro-plan",
  mode: "subscription",
  name: "Example Pro plan",
  nameKey: "@vitnode/example.payments.offers.pro-plan.name",
  returnPath: EXAMPLE_RETURN_PATH,
  intervals: {
    month: { EUR: 449, PLN: 1900, USD: 499 },
    year: { EUR: 4490, PLN: 19000, USD: 4990 },
  },

  // Set, never add: the same subscription state can arrive more than once.
  onSubscriptionChanged: async ({ subscription, tx }) => {
    if (subscription.userId === null) return;

    const accessUntil = subscriptionAccessUntil(subscription);
    // No verified payment yet - nothing to grant. `null` would mean "forever".
    if (!accessUntil) return;

    await tx
      .insert(example_payments_access)
      .values({
        accessUntil,
        offerId: subscription.offerId,
        purchaseId: subscription.purchaseId,
        userId: subscription.userId,
      })
      .onConflictDoUpdate({
        set: {
          accessUntil,
          purchaseId: subscription.purchaseId,
          revokedAt: null,
        },
        target: [
          example_payments_access.userId,
          example_payments_access.offerId,
        ],
      });
  },
});

export const exampleOffers = [lifetimePassOffer, proPlanOffer];
