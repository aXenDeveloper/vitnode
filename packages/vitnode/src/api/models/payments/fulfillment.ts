import { and, eq, sql } from "drizzle-orm";

import type { PaymentsTransaction } from "@/payments/offer";

import {
  core_payments_fulfillments,
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";

import type { PaymentsContext } from "./shared";

import {
  describePaymentsError,
  emitPaymentsEvent,
  findRegisteredOffer,
  PaymentsPermanentError,
  purchaseSnapshot,
  subscriptionSnapshot,
} from "./shared";

export const FULFILL_TASK = "payments-fulfill";

/** The plugin effects a purchase can have. Refunds are one per refund id. */
export const FULFILLMENT_EFFECTS = {
  grant: "grant",
  refund: (refundId: string) => `refund:${refundId}`,
  subscription: "subscription",
} as const;

const affectsPurchaseStatus = (effect: string): boolean =>
  effect === FULFILLMENT_EFFECTS.grant ||
  effect === FULFILLMENT_EFFECTS.subscription;

/**
 * Records that a business effect is owed and queues it - in the caller's
 * transaction, so the payment state and the work it causes commit together.
 *
 * The row is unique per purchase and effect: asking twice for the same effect
 * finds the existing row. `rerun` is for state-based effects (a subscription
 * changed again) - it moves the generation on so the handler runs once more
 * with the newest state, still without granting anything twice.
 */
export const scheduleFulfillment = async (
  c: PaymentsContext,
  tx: PaymentsTransaction,
  {
    effect,
    payload = {},
    purchaseId,
    rerun = false,
  }: {
    effect: string;
    payload?: Record<string, number | string>;
    purchaseId: number;
    rerun?: boolean;
  },
): Promise<void> => {
  const [inserted] = await tx
    .insert(core_payments_fulfillments)
    .values({ effect, payload, purchaseId })
    .onConflictDoNothing()
    .returning({ id: core_payments_fulfillments.id });

  let id = inserted?.id;

  if (!id && rerun) {
    const [bumped] = await tx
      .update(core_payments_fulfillments)
      .set({
        generation: sql`${core_payments_fulfillments.generation} + 1`,
        status: "pending",
      })
      .where(
        and(
          eq(core_payments_fulfillments.purchaseId, purchaseId),
          eq(core_payments_fulfillments.effect, effect),
        ),
      )
      .returning({ id: core_payments_fulfillments.id });
    id = bumped?.id;
  }

  if (!id) return;

  if (affectsPurchaseStatus(effect)) {
    await tx
      .update(core_payments_purchases)
      .set({ fulfillmentStatus: "pending" })
      .where(eq(core_payments_purchases.id, purchaseId));
  }

  await c.get("queue").dispatch({
    maxAttempts: 5,
    name: FULFILL_TASK,
    payload: { fulfillmentId: id },
    pluginId: "@vitnode/core",
    tx,
  });
};

const recordFailure = async (
  c: PaymentsContext,
  fulfillment: { effect: string; id: number; purchaseId: number },
  error: unknown,
): Promise<void> => {
  const db = c.get("db");
  const message = describePaymentsError(error);

  await db
    .update(core_payments_fulfillments)
    .set({
      attempts: sql`${core_payments_fulfillments.attempts} + 1`,
      lastError: message,
      status: "failed",
    })
    .where(eq(core_payments_fulfillments.id, fulfillment.id));

  // The payment stays paid. Only the fulfillment is marked failed.
  if (affectsPurchaseStatus(fulfillment.effect)) {
    await db
      .update(core_payments_purchases)
      .set({ fulfillmentStatus: "failed", lastError: message })
      .where(eq(core_payments_purchases.id, fulfillment.purchaseId));
  }

  await c
    .get("log")
    .error(
      `[Payments] Fulfillment ${fulfillment.id} (${fulfillment.effect}) failed: ${message}`,
    );
};

/**
 * Runs one fulfillment. Safe to call any number of times: the row is locked
 * for the handler's transaction, and a generation that already completed is
 * skipped. The plugin's write and the "completed" mark commit together, so a
 * crash in between leaves nothing granted and the retry starts clean.
 *
 * Throws on a retryable failure so the queue tries again; returns after
 * recording a permanent one (for example, the offer is no longer registered).
 */
export const runFulfillment = async (
  c: PaymentsContext,
  fulfillmentId: number,
): Promise<"completed" | "failed" | "skipped"> => {
  const db = c.get("db");
  const [row] = await db
    .select({
      effect: core_payments_fulfillments.effect,
      id: core_payments_fulfillments.id,
      offerId: core_payments_purchases.offerId,
      pluginId: core_payments_purchases.pluginId,
      purchaseId: core_payments_fulfillments.purchaseId,
    })
    .from(core_payments_fulfillments)
    .innerJoin(
      core_payments_purchases,
      eq(core_payments_purchases.id, core_payments_fulfillments.purchaseId),
    )
    .where(eq(core_payments_fulfillments.id, fulfillmentId))
    .limit(1);

  if (!row) return "skipped";

  const registered = findRegisteredOffer(c, row.pluginId, row.offerId);

  if (!registered) {
    // Never substitute another handler or grant something else: the purchase
    // stays paid and the gap is visible in the AdminCP until the plugin is back.
    await recordFailure(
      c,
      row,
      new PaymentsPermanentError(
        `Offer "${row.pluginId}:${row.offerId}" is not registered - its plugin is disabled or the offer was removed. Nothing was granted; re-enable it and retry.`,
      ),
    );

    return "failed";
  }

  const { offer } = registered;
  let outcome: "completed" | "skipped" = "skipped";
  let completedEffect: null | string = null;

  try {
    await db.transaction(async tx => {
      const [locked] = await tx
        .select()
        .from(core_payments_fulfillments)
        .where(eq(core_payments_fulfillments.id, fulfillmentId))
        .for("update");

      if (!locked || locked.completedGeneration >= locked.generation) return;

      const [purchase] = await tx
        .select()
        .from(core_payments_purchases)
        .where(eq(core_payments_purchases.id, locked.purchaseId))
        .for("update");

      if (!purchase) return;

      if (locked.effect === FULFILLMENT_EFFECTS.grant) {
        if (offer.mode !== "one_time") {
          throw new PaymentsPermanentError(
            `Offer "${row.pluginId}:${row.offerId}" is no longer a one-time offer.`,
          );
        }

        await offer.onPaid({ c, purchase: purchaseSnapshot(purchase), tx });
      } else if (locked.effect.startsWith("refund:")) {
        if (offer.mode === "one_time" && offer.onRefunded) {
          await offer.onRefunded({
            c,
            purchase: purchaseSnapshot(purchase),
            refund: {
              amount: Number(locked.payload.amount ?? 0),
              id: locked.effect.slice("refund:".length),
            },
            tx,
          });
        }
      } else if (locked.effect === FULFILLMENT_EFFECTS.subscription) {
        if (offer.mode !== "subscription") {
          throw new PaymentsPermanentError(
            `Offer "${row.pluginId}:${row.offerId}" is no longer a subscription offer.`,
          );
        }

        const [subscription] = await tx
          .select()
          .from(core_payments_subscriptions)
          .where(eq(core_payments_subscriptions.purchaseId, purchase.id));

        if (subscription) {
          await offer.onSubscriptionChanged({
            c,
            subscription: subscriptionSnapshot(subscription, purchase),
            tx,
          });
        }
      }

      await tx
        .update(core_payments_fulfillments)
        .set({
          attempts: sql`${core_payments_fulfillments.attempts} + 1`,
          completedAt: new Date(),
          completedGeneration: locked.generation,
          lastError: null,
          status: "completed",
        })
        .where(eq(core_payments_fulfillments.id, locked.id));

      if (affectsPurchaseStatus(locked.effect)) {
        await tx
          .update(core_payments_purchases)
          .set({ fulfillmentStatus: "fulfilled", lastError: null })
          .where(eq(core_payments_purchases.id, purchase.id));
        completedEffect = locked.effect;
      }

      outcome = "completed";
    });
  } catch (error) {
    await recordFailure(c, row, error);

    if (error instanceof Error && error.name === "PaymentsPermanentError") {
      return "failed";
    }

    throw error;
  }

  if (completedEffect === FULFILLMENT_EFFECTS.grant) {
    const [purchase] = await db
      .select({ publicId: core_payments_purchases.publicId })
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, row.purchaseId));

    if (purchase) {
      await emitPaymentsEvent(c, "payments.purchase.fulfilled", {
        offerId: row.offerId,
        pluginId: row.pluginId,
        purchaseId: purchase.publicId,
      });
    }
  }

  return outcome;
};

/**
 * Puts a failed fulfillment back on the queue. Idempotent: a fulfillment whose
 * current generation already completed is left alone, so a double click on
 * "Retry" cannot grant twice.
 */
export const retryFulfillment = async (
  c: PaymentsContext,
  fulfillmentId: number,
): Promise<boolean> =>
  await c.get("db").transaction(async tx => {
    const [row] = await tx
      .update(core_payments_fulfillments)
      .set({ status: "pending" })
      .where(
        and(
          eq(core_payments_fulfillments.id, fulfillmentId),
          sql`${core_payments_fulfillments.completedGeneration} < ${core_payments_fulfillments.generation}`,
        ),
      )
      .returning({
        effect: core_payments_fulfillments.effect,
        purchaseId: core_payments_fulfillments.purchaseId,
      });

    if (!row) return false;

    if (affectsPurchaseStatus(row.effect)) {
      await tx
        .update(core_payments_purchases)
        .set({ fulfillmentStatus: "pending" })
        .where(eq(core_payments_purchases.id, row.purchaseId));
    }

    await c.get("queue").dispatch({
      maxAttempts: 5,
      name: FULFILL_TASK,
      payload: { fulfillmentId },
      pluginId: "@vitnode/core",
      tx,
    });

    return true;
  });
