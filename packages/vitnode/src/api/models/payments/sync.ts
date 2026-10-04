import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import type {
  PaymentProvider,
  ProviderCheckout,
  ProviderInvoice,
  ProviderPayment,
  ProviderSubscription,
} from "@/payments/provider";
import type {
  InvoiceStatus,
  PurchasePaymentStatus,
  RefundStatus,
} from "@/payments/status";

import {
  core_payments_adjustments,
  core_payments_checkouts,
  core_payments_invoices,
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";
import { assertMinorUnits } from "@/payments/money";
import {
  nextPurchasePaymentStatus,
  TERMINAL_SUBSCRIPTION_STATUSES,
} from "@/payments/status";

import type { PaymentsContext, PurchaseRow, SubscriptionRow } from "./shared";

import { FULFILLMENT_EFFECTS, scheduleFulfillment } from "./fulfillment";
import { emitPaymentsEvent, PaymentsPermanentError } from "./shared";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long reconciliation waits before asking about a still-processing payment. */
export const PROCESSING_RECHECK_MS = 15 * MINUTE;

const observedPaymentStatus = (
  checkout: ProviderCheckout,
): PurchasePaymentStatus => {
  if (checkout.status === "expired") return "expired";
  if (checkout.status === "open") return "awaiting_payment";
  if (checkout.paymentStatus === "failed") return "failed";
  if (checkout.paymentStatus === "unpaid") return "processing";

  return "paid";
};

const findPurchaseForCheckout = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  checkout: ProviderCheckout,
): Promise<PurchaseRow> => {
  const db = c.get("db");

  if (checkout.reference && /^[0-9a-f-]{36}$/i.test(checkout.reference)) {
    const [byReference] = await db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.publicId, checkout.reference));

    if (byReference) return byReference;
  }

  const [byCheckout] = await db
    .select({ purchase: core_payments_purchases })
    .from(core_payments_checkouts)
    .innerJoin(
      core_payments_purchases,
      eq(core_payments_purchases.id, core_payments_checkouts.purchaseId),
    )
    .where(
      and(
        eq(core_payments_checkouts.provider, provider.id),
        eq(core_payments_checkouts.providerScope, provider.scope),
        eq(core_payments_checkouts.externalId, checkout.id),
      ),
    );

  if (byCheckout) return byCheckout.purchase;

  throw new PaymentsPermanentError(
    `Checkout ${checkout.id} does not belong to any purchase on this site.`,
  );
};

/**
 * Applies a checkout's authoritative state to its purchase. Called from the
 * webhook queue, reconciliation and the buyer's own status refresh - all three
 * re-read the checkout from the provider first, so the order events arrive in
 * does not matter and an older snapshot can never move the purchase back.
 */
export const applyCheckoutState = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  checkout: ProviderCheckout,
): Promise<{ purchase: PurchaseRow; subscriptionId: null | string }> => {
  const found = await findPurchaseForCheckout(c, provider, checkout);

  if (
    found.provider !== provider.id ||
    found.providerScope !== provider.scope
  ) {
    throw new PaymentsPermanentError(
      `Checkout ${checkout.id} came from "${provider.id}/${provider.scope}" but purchase ${found.publicId} was started with "${found.provider}/${found.providerScope}".`,
    );
  }

  const observed = observedPaymentStatus(checkout);
  let becamePaid = false;

  const purchase = await c.get("db").transaction(async tx => {
    const [current] = await tx
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, found.id))
      .for("update");

    const next = nextPurchasePaymentStatus(current.paymentStatus, observed);
    becamePaid = next === "paid" && current.paymentStatus !== "paid";

    // A charge that does not match the snapshot is recorded, never fulfilled
    // automatically: something outside this code changed the price.
    const mismatch =
      becamePaid &&
      checkout.amountTotal !== null &&
      (checkout.amountTotal !== current.amount ||
        (checkout.currency !== null && checkout.currency !== current.currency))
        ? `Charged ${checkout.amountTotal} ${checkout.currency ?? "?"} but the purchase was for ${current.amount} ${current.currency}. Fulfillment held for review.`
        : null;

    const [updated] = await tx
      .update(core_payments_purchases)
      .set({
        externalCustomerId: checkout.customerId ?? current.externalCustomerId,
        externalPaymentId: checkout.paymentId ?? current.externalPaymentId,
        lastError: mismatch ?? current.lastError,
        nextCheckAt:
          next === "processing"
            ? new Date(Date.now() + PROCESSING_RECHECK_MS)
            : next === "awaiting_payment"
              ? current.nextCheckAt
              : null,
        paidAt: becamePaid ? new Date() : current.paidAt,
        paymentStatus: next,
      })
      .where(eq(core_payments_purchases.id, current.id))
      .returning();

    await tx
      .update(core_payments_checkouts)
      .set({
        externalId: checkout.id,
        status: checkout.status,
        url: checkout.status === "open" ? checkout.url : null,
      })
      .where(
        and(
          eq(core_payments_checkouts.purchaseId, current.id),
          eq(core_payments_checkouts.provider, provider.id),
          eq(core_payments_checkouts.externalId, checkout.id),
        ),
      );

    if (becamePaid && current.mode === "one_time") {
      if (mismatch) {
        await tx
          .update(core_payments_purchases)
          .set({ fulfillmentStatus: "failed" })
          .where(eq(core_payments_purchases.id, current.id));
      } else {
        await scheduleFulfillment(c, tx, {
          effect: FULFILLMENT_EFFECTS.grant,
          purchaseId: current.id,
        });
      }
    }

    return updated;
  });

  if (becamePaid) {
    await emitPaymentsEvent(c, "payments.purchase.paid", {
      amount: purchase.amount,
      currency: purchase.currency,
      offerId: purchase.offerId,
      pluginId: purchase.pluginId,
      purchaseId: purchase.publicId,
      userId: purchase.userId,
    });
  }

  return { purchase, subscriptionId: checkout.subscriptionId };
};

const requireSubscriptions = (provider: PaymentProvider) => {
  if (!provider.subscriptions) {
    throw new PaymentsPermanentError(
      `Provider "${provider.id}" does not support subscriptions.`,
    );
  }

  return provider.subscriptions;
};

/** When reconciliation should look at a subscription again - bounded, never "always". */
const nextSubscriptionCheck = (
  state: ProviderSubscription,
  now = Date.now(),
): Date | null => {
  if (TERMINAL_SUBSCRIPTION_STATUSES.includes(state.status)) return null;

  if (state.status !== "active") return new Date(now + 6 * HOUR);

  // Just after the period ends - which is when a renewal has to have happened.
  const periodEnd = state.currentPeriodEnd?.getTime();

  return new Date(
    periodEnd && periodEnd > now ? periodEnd + HOUR : now + 24 * HOUR,
  );
};

const findPurchaseForSubscription = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  state: ProviderSubscription,
  checkoutPurchase?: PurchaseRow,
): Promise<PurchaseRow> => {
  if (checkoutPurchase) return checkoutPurchase;

  if (state.reference && /^[0-9a-f-]{36}$/i.test(state.reference)) {
    const [purchase] = await c
      .get("db")
      .select()
      .from(core_payments_purchases)
      .where(
        and(
          eq(core_payments_purchases.publicId, state.reference),
          eq(core_payments_purchases.provider, provider.id),
          eq(core_payments_purchases.providerScope, provider.scope),
        ),
      );

    if (purchase) return purchase;
  }

  throw new PaymentsPermanentError(
    `Subscription ${state.id} was not started from a checkout on this site.`,
  );
};

const changedForPlugin = (
  before: SubscriptionRow | undefined,
  after: SubscriptionRow,
): boolean => {
  if (!before) return true;

  return (
    before.status !== after.status ||
    before.cancelAtPeriodEnd !== after.cancelAtPeriodEnd ||
    before.paidThrough?.getTime() !== after.paidThrough?.getTime() ||
    before.endedAt?.getTime() !== after.endedAt?.getTime()
  );
};

const afterSubscriptionChange = async (
  c: PaymentsContext,
  row: SubscriptionRow,
): Promise<void> => {
  await emitPaymentsEvent(c, "payments.subscription.updated", {
    offerId: row.offerId,
    paidThrough: row.paidThrough?.toISOString() ?? null,
    pluginId: row.pluginId,
    status: row.status,
    subscriptionId: row.publicId,
  });
};

/**
 * Re-reads a subscription and its latest invoice from the provider and stores
 * them. Handles Customer Portal changes, cancellations and ends the same way:
 * whatever the provider says now is what is stored, and the plugin is told
 * only when something it can act on changed.
 */
export const syncSubscription = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  subscriptionId: string,
  { checkoutPurchase }: { checkoutPurchase?: PurchaseRow } = {},
): Promise<SubscriptionRow> => {
  const api = requireSubscriptions(provider);
  const state = await api.retrieve(subscriptionId);
  const db = c.get("db");

  const [existing] = await db
    .select()
    .from(core_payments_subscriptions)
    .where(
      and(
        eq(core_payments_subscriptions.provider, provider.id),
        eq(core_payments_subscriptions.providerScope, provider.scope),
        eq(core_payments_subscriptions.externalId, state.id),
      ),
    );

  const purchaseId =
    existing?.purchaseId ??
    (await findPurchaseForSubscription(c, provider, state, checkoutPurchase))
      .id;

  let changed = false;

  const row = await db.transaction(async tx => {
    const [owner] = await tx
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchaseId))
      .for("update");

    const [before] = await tx
      .select()
      .from(core_payments_subscriptions)
      .where(eq(core_payments_subscriptions.purchaseId, owner.id));

    const values = {
      cancelAt: state.cancelAt,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      canceledAt: state.canceledAt,
      currentPeriodEnd: state.currentPeriodEnd,
      endedAt: state.endedAt,
      externalCustomerId: state.customerId,
      externalPriceId: state.priceId ?? before?.externalPriceId ?? null,
      lastError: null,
      nextCheckAt: nextSubscriptionCheck(state),
      providerStatus: state.providerStatus,
      status: state.status,
      syncedAt: new Date(),
    };

    const [stored] = before
      ? await tx
          .update(core_payments_subscriptions)
          .set(values)
          .where(eq(core_payments_subscriptions.id, before.id))
          .returning()
      : await tx
          .insert(core_payments_subscriptions)
          .values({
            ...values,
            amount: assertMinorUnits(state.amount ?? owner.amount),
            currency: state.currency ?? owner.currency,
            externalId: state.id,
            interval: state.interval ?? owner.interval ?? "month",
            offerId: owner.offerId,
            offerName: owner.offerName,
            pluginId: owner.pluginId,
            provider: provider.id,
            providerScope: provider.scope,
            purchaseId: owner.id,
            userId: owner.userId,
          })
          .returning();

    // A first payment that never completed ends the purchase as failed.
    if (
      state.status === "incomplete_expired" &&
      (owner.paymentStatus === "awaiting_payment" ||
        owner.paymentStatus === "processing")
    ) {
      await tx
        .update(core_payments_purchases)
        .set({ nextCheckAt: null, paymentStatus: "failed" })
        .where(eq(core_payments_purchases.id, owner.id));
    }

    changed = changedForPlugin(before, stored);

    if (changed) {
      await scheduleFulfillment(c, tx, {
        effect: FULFILLMENT_EFFECTS.subscription,
        purchaseId: owner.id,
        rerun: true,
      });
    }

    return stored;
  });

  if (changed) await afterSubscriptionChange(c, row);

  // An `invoice.paid` webhook that never arrived must not cost the subscriber
  // their access, so the latest invoice is checked on every sync.
  if (state.latestInvoiceId) {
    const [known] = await db
      .select({ status: core_payments_invoices.status })
      .from(core_payments_invoices)
      .where(
        and(
          eq(core_payments_invoices.provider, provider.id),
          eq(core_payments_invoices.providerScope, provider.scope),
          eq(core_payments_invoices.externalId, state.latestInvoiceId),
        ),
      );

    if (known?.status !== "paid") {
      return (
        (await syncInvoice(c, provider, state.latestInvoiceId, "updated", {
          subscription: row,
        })) ?? row
      );
    }
  }

  return row;
};

const invoiceStatusFor = (
  invoice: ProviderInvoice,
  signal: "action_required" | "paid" | "payment_failed" | "updated",
  current: InvoiceStatus | undefined,
): InvoiceStatus => {
  if (current === "paid" || invoice.status !== "open") {
    return current === "paid" ? "paid" : invoice.status;
  }

  if (signal === "payment_failed") return "payment_failed";
  if (signal === "action_required") return "action_required";

  return current ?? "open";
};

const laterOf = (a: Date | null, b: Date | null): Date | null => {
  if (!a) return b;
  if (!b) return a;

  return a > b ? a : b;
};

/**
 * Stores one recurring charge and, when it is paid, moves the subscription's
 * paid-through boundary to the end of the period it paid for. The boundary is
 * the latest *verified* period end, never "now + one month": retrying the same
 * invoice changes nothing, and a failed renewal leaves the paid period alone.
 */
export const syncInvoice = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  invoiceId: string,
  signal: "action_required" | "paid" | "payment_failed" | "updated",
  { subscription: known }: { subscription?: SubscriptionRow } = {},
): Promise<SubscriptionRow | undefined> => {
  const api = requireSubscriptions(provider);
  const invoice = await api.retrieveInvoice(invoiceId);

  // An invoice for something VitNode never sold - not ours to record.
  if (!invoice.subscriptionId) return undefined;

  const db = c.get("db");
  let subscription = known;

  if (!subscription) {
    [subscription] = await db
      .select()
      .from(core_payments_subscriptions)
      .where(
        and(
          eq(core_payments_subscriptions.provider, provider.id),
          eq(core_payments_subscriptions.providerScope, provider.scope),
          eq(core_payments_subscriptions.externalId, invoice.subscriptionId),
        ),
      );
  }

  // The invoice can arrive before the checkout that created the
  // subscription was processed. Syncing the subscription first records it.
  subscription ??= await syncSubscription(c, provider, invoice.subscriptionId);

  let changed = false;
  let purchasePaid: null | PurchaseRow = null;

  const row = await db.transaction(async tx => {
    const [locked] = await tx
      .select()
      .from(core_payments_subscriptions)
      .where(eq(core_payments_subscriptions.id, subscription.id))
      .for("update");

    const [existing] = await tx
      .select()
      .from(core_payments_invoices)
      .where(
        and(
          eq(core_payments_invoices.provider, provider.id),
          eq(core_payments_invoices.providerScope, provider.scope),
          eq(core_payments_invoices.externalId, invoice.id),
        ),
      );

    const status = invoiceStatusFor(invoice, signal, existing?.status);
    const values = {
      amountDue: assertMinorUnits(invoice.amountDue),
      amountPaid: assertMinorUnits(invoice.amountPaid),
      billingReason: invoice.billingReason,
      currency: invoice.currency,
      externalPaymentId:
        invoice.paymentId ?? existing?.externalPaymentId ?? null,
      paidAt: invoice.paidAt ?? existing?.paidAt ?? null,
      periodEnd: invoice.periodEnd,
      periodStart: invoice.periodStart,
      providerStatus: invoice.providerStatus,
      status,
    };

    if (existing) {
      await tx
        .update(core_payments_invoices)
        .set(values)
        .where(eq(core_payments_invoices.id, existing.id));
    } else {
      await tx.insert(core_payments_invoices).values({
        ...values,
        externalId: invoice.id,
        provider: provider.id,
        providerScope: provider.scope,
        subscriptionId: locked.id,
      });
    }

    const paidThrough =
      status === "paid"
        ? laterOf(locked.paidThrough, invoice.periodEnd)
        : locked.paidThrough;

    const [stored] = await tx
      .update(core_payments_subscriptions)
      .set({ paidThrough })
      .where(eq(core_payments_subscriptions.id, locked.id))
      .returning();

    // The first paid invoice is the subscription purchase's payment.
    if (status === "paid") {
      const [purchase] = await tx
        .update(core_payments_purchases)
        .set({
          nextCheckAt: null,
          paidAt: invoice.paidAt ?? new Date(),
          paymentStatus: "paid",
        })
        .where(
          and(
            eq(core_payments_purchases.id, locked.purchaseId),
            notInArray(core_payments_purchases.paymentStatus, ["paid"]),
          ),
        )
        .returning();

      purchasePaid = purchase ?? null;
    }

    changed = changedForPlugin(locked, stored);

    if (changed) {
      await scheduleFulfillment(c, tx, {
        effect: FULFILLMENT_EFFECTS.subscription,
        purchaseId: locked.purchaseId,
        rerun: true,
      });
    }

    return stored;
  });

  if (purchasePaid) {
    const paid: PurchaseRow = purchasePaid;
    await emitPaymentsEvent(c, "payments.purchase.paid", {
      amount: paid.amount,
      currency: paid.currency,
      offerId: paid.offerId,
      pluginId: paid.pluginId,
      purchaseId: paid.publicId,
      userId: paid.userId,
    });
  }

  if (changed) await afterSubscriptionChange(c, row);

  return row;
};

const refundStatusOf = (refunded: number, paid: number): RefundStatus => {
  if (refunded <= 0) return "none";

  return refunded >= paid ? "full" : "partial";
};

const disputeStatusOf = (payment: ProviderPayment) => {
  if (payment.disputes.length === 0) return null;
  if (payment.disputes.some(dispute => dispute.status === "open"))
    return "open";
  if (payment.disputes.some(dispute => dispute.status === "lost"))
    return "lost";

  return "won";
};

/**
 * Records refunds and disputes for one payment against the purchase or the
 * recurring invoice it paid for. The original paid amount is never changed.
 * A one-time purchase gets one plugin call per refund that succeeded - the
 * plugin decides what a refund means for access.
 */
export const syncPayment = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  paymentId: string,
): Promise<void> => {
  const facts = await provider.payments.retrieve(paymentId);
  const db = c.get("db");
  const [purchase] = await db
    .select()
    .from(core_payments_purchases)
    .where(
      and(
        eq(core_payments_purchases.provider, provider.id),
        eq(core_payments_purchases.providerScope, provider.scope),
        eq(core_payments_purchases.externalPaymentId, paymentId),
      ),
    );

  const [invoice] = purchase
    ? []
    : await db
        .select()
        .from(core_payments_invoices)
        .where(
          and(
            eq(core_payments_invoices.provider, provider.id),
            eq(core_payments_invoices.providerScope, provider.scope),
            eq(core_payments_invoices.externalPaymentId, paymentId),
          ),
        );

  if (!purchase && !invoice) {
    // Usually the refund raced the payment's own confirmation. Retried by the
    // queue; if it never resolves, it is not a payment this site took.
    throw new Error(
      `Payment ${paymentId} is not linked to a purchase or invoice yet.`,
    );
  }

  const disputeStatus = disputeStatusOf(facts);
  const newRefunds: { amount: number; id: string }[] = [];
  let refundedPurchase: null | PurchaseRow = null;

  await db.transaction(async tx => {
    if (purchase) {
      await tx
        .select({ id: core_payments_purchases.id })
        .from(core_payments_purchases)
        .where(eq(core_payments_purchases.id, purchase.id))
        .for("update");
    } else {
      await tx
        .select({ id: core_payments_invoices.id })
        .from(core_payments_invoices)
        .where(eq(core_payments_invoices.id, invoice.id))
        .for("update");
    }

    const owner = purchase
      ? { invoiceId: null, purchaseId: purchase.id }
      : { invoiceId: invoice.id, purchaseId: null };

    const adjustments = [
      ...facts.refunds.map(refund => ({
        amount: refund.amount,
        id: refund.id,
        kind: "refund" as const,
        reason: null,
        status: refund.status,
      })),
      ...facts.disputes.map(dispute => ({
        amount: dispute.amount,
        id: dispute.id,
        kind: "dispute" as const,
        reason: dispute.reason,
        status: dispute.providerStatus,
      })),
    ];

    for (const adjustment of adjustments) {
      const [before] = await tx
        .select({ status: core_payments_adjustments.status })
        .from(core_payments_adjustments)
        .where(
          and(
            eq(core_payments_adjustments.provider, provider.id),
            eq(core_payments_adjustments.providerScope, provider.scope),
            eq(core_payments_adjustments.kind, adjustment.kind),
            eq(core_payments_adjustments.externalId, adjustment.id),
          ),
        );

      await tx
        .insert(core_payments_adjustments)
        .values({
          ...owner,
          amount: assertMinorUnits(adjustment.amount),
          currency: facts.currency,
          externalId: adjustment.id,
          kind: adjustment.kind,
          provider: provider.id,
          providerScope: provider.scope,
          reason: adjustment.reason,
          status: adjustment.status,
        })
        .onConflictDoUpdate({
          set: { reason: adjustment.reason, status: adjustment.status },
          target: [
            core_payments_adjustments.provider,
            core_payments_adjustments.providerScope,
            core_payments_adjustments.kind,
            core_payments_adjustments.externalId,
          ],
        });

      if (
        adjustment.kind === "refund" &&
        adjustment.status === "succeeded" &&
        before?.status !== "succeeded"
      ) {
        newRefunds.push({ amount: adjustment.amount, id: adjustment.id });
      }
    }

    const refundedAmount = assertMinorUnits(facts.amountRefunded);

    if (purchase) {
      const [updated] = await tx
        .update(core_payments_purchases)
        .set({
          disputeStatus,
          refundedAmount,
          refundStatus: refundStatusOf(refundedAmount, purchase.amount),
        })
        .where(eq(core_payments_purchases.id, purchase.id))
        .returning();

      if (purchase.mode === "one_time") {
        for (const refund of newRefunds) {
          await scheduleFulfillment(c, tx, {
            effect: FULFILLMENT_EFFECTS.refund(refund.id),
            payload: { amount: refund.amount },
            purchaseId: purchase.id,
          });
        }
      }

      if (updated.refundedAmount !== purchase.refundedAmount) {
        refundedPurchase = updated;
      }
    } else {
      await tx
        .update(core_payments_invoices)
        .set({
          disputeStatus,
          refundedAmount,
          refundStatus: refundStatusOf(refundedAmount, invoice.amountPaid),
        })
        .where(eq(core_payments_invoices.id, invoice.id));
    }
  });

  if (refundedPurchase) {
    const refunded: PurchaseRow = refundedPurchase;
    await emitPaymentsEvent(c, "payments.purchase.refunded", {
      currency: refunded.currency,
      purchaseId: refunded.publicId,
      refundedAmount: refunded.refundedAmount,
      refundStatus: refunded.refundStatus,
    });
  }
};

/**
 * Asks the provider about a purchase that is still open and applies the
 * answer. Used by reconciliation and by the buyer's "check again" after
 * returning from checkout - the redirect itself proves nothing.
 */
export const refreshPurchase = async (
  c: PaymentsContext,
  provider: PaymentProvider,
  purchase: PurchaseRow,
): Promise<PurchaseRow> => {
  if (
    purchase.paymentStatus !== "awaiting_payment" &&
    purchase.paymentStatus !== "processing"
  ) {
    return purchase;
  }

  const [checkout] = await c
    .get("db")
    .select()
    .from(core_payments_checkouts)
    .where(
      and(
        eq(core_payments_checkouts.purchaseId, purchase.id),
        inArray(core_payments_checkouts.status, ["open", "complete"]),
        sql`${core_payments_checkouts.externalId} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${core_payments_checkouts.id} DESC`)
    .limit(1);

  if (!checkout?.externalId) return purchase;

  const state = await provider.checkout.retrieve(checkout.externalId);
  const applied = await applyCheckoutState(c, provider, state);

  if (applied.subscriptionId) {
    await syncSubscription(c, provider, applied.subscriptionId, {
      checkoutPurchase: applied.purchase,
    });

    const [fresh] = await c
      .get("db")
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchase.id));

    return fresh;
  }

  return applied.purchase;
};
