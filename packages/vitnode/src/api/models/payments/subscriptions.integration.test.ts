// @vitest-environment node
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { afterAll, beforeAll, expect, it } from "vitest";

import {
  core_payments_invoices,
  core_payments_purchases,
  core_payments_subscriptions,
} from "@/database/payments";
import { definePaymentOffer } from "@/payments/offer";
import { subscriptionDisplayState } from "@/payments/status";
import {
  createPaymentsHarness,
  must,
  type PaymentsHarness,
  TEST_PLUGIN_ID,
} from "@/tests/payments";
import { describePostgres } from "@/tests/postgres";

import { createPortalSession, startCheckout } from "./checkout";
import { reconcilePayments } from "./reconcile";
import { refreshPurchase, syncInvoice, syncSubscription } from "./sync";

const DAY = 24 * 60 * 60 * 1000;

/** Prices that a test changes after people subscribed. */
const repricedPlan = definePaymentOffer({
  id: "repriced",
  intervals: { month: { PLN: 1900 } },
  mode: "subscription",
  name: "Repriced plan",
  onSubscriptionChanged: async () => {},
  returnPath: "/example/payments",
});

const errorCode = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HTTPException) {
      return ((await error.getResponse().json()) as { code: string }).code;
    }
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describePostgres("subscriptions", () => {
  let h: PaymentsHarness;

  beforeAll(async () => {
    h = await createPaymentsHarness({ offers: [repricedPlan] });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const subscribe = async (
    interval: "month" | "year" = "month",
    offerId = "plan",
  ) => {
    const user = await h.createUser();
    const { purchase } = await startCheckout(h.c, user, {
      currency: "PLN",
      interval,
      offerId,
      pluginId: TEST_PLUGIN_ID,
    });
    const checkout = must(
      [...h.fake.checkouts.values()].find(
        item => item.reference === purchase.publicId,
      ),
    );
    const { subscriptionId } = h.fake.complete(checkout.id);
    await refreshPurchase(h.c, h.fake.provider, purchase);
    await h.drainQueue();

    return { purchase, subscriptionId: must(subscriptionId), user };
  };

  const local = async (externalId: string) =>
    must(
      (
        await h.database.db
          .select()
          .from(core_payments_subscriptions)
          .where(eq(core_payments_subscriptions.externalId, externalId))
      )[0],
    );

  it("grants access from the first verified payment until the period it paid for", async () => {
    const { purchase, subscriptionId, user } = await subscribe("year");
    const stored = await local(subscriptionId);
    const providerEnd = must(
      h.fake.subscriptions.get(subscriptionId),
    ).currentPeriodEnd;

    expect(stored).toMatchObject({
      amount: 19000,
      currency: "PLN",
      interval: "year",
      paidThrough: providerEnd,
      status: "active",
    });
    const [purchaseRow] = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchase.id));
    expect(purchaseRow).toMatchObject({
      fulfillmentStatus: "fulfilled",
      paymentStatus: "paid",
    });
    expect((await h.access(user.id))[0].accessUntil).toEqual(providerEnd);
  });

  it("extends access once per verified renewal, however often it is reported", async () => {
    const { subscriptionId, user } = await subscribe();
    const invoiceId = h.fake.renew(subscriptionId, "paid");
    const renewedEnd = must(h.fake.invoices.get(invoiceId)).periodEnd;

    await syncInvoice(h.c, h.fake.provider, invoiceId, "paid");
    await syncInvoice(h.c, h.fake.provider, invoiceId, "paid");
    await syncSubscription(h.c, h.fake.provider, subscriptionId);
    await h.drainQueue();

    expect((await local(subscriptionId)).paidThrough).toEqual(renewedEnd);
    expect((await h.access(user.id))[0].accessUntil).toEqual(renewedEnd);
    expect(
      await h.database.db
        .select()
        .from(core_payments_invoices)
        .where(eq(core_payments_invoices.externalId, invoiceId)),
    ).toHaveLength(1);
  });

  it("keeps the paid period when a renewal fails, and asks for attention", async () => {
    const { subscriptionId, user } = await subscribe();
    const paidThrough = (await local(subscriptionId)).paidThrough;
    const invoiceId = h.fake.renew(subscriptionId, "failed");

    await syncInvoice(h.c, h.fake.provider, invoiceId, "payment_failed");
    await syncSubscription(h.c, h.fake.provider, subscriptionId);
    await h.drainQueue();

    const stored = await local(subscriptionId);
    expect(stored.status).toBe("past_due");
    expect(stored.paidThrough).toEqual(paidThrough);
    expect(subscriptionDisplayState(stored)).toBe("needs_attention");
    expect((await h.access(user.id))[0].accessUntil).toEqual(paidThrough);

    const [invoice] = await h.database.db
      .select()
      .from(core_payments_invoices)
      .where(eq(core_payments_invoices.externalId, invoiceId));
    expect(invoice.status).toBe("payment_failed");
  });

  it("records a renewal that needs the customer to act", async () => {
    const { subscriptionId } = await subscribe();
    const invoiceId = h.fake.renew(subscriptionId, "action_required");

    await syncInvoice(h.c, h.fake.provider, invoiceId, "action_required");

    const [invoice] = await h.database.db
      .select()
      .from(core_payments_invoices)
      .where(eq(core_payments_invoices.externalId, invoiceId));
    expect(invoice.status).toBe("action_required");
  });

  it("keeps access until the period ends after a cancellation is scheduled", async () => {
    const { subscriptionId, user } = await subscribe();
    const before = await local(subscriptionId);
    const remote = must(h.fake.subscriptions.get(subscriptionId));
    remote.cancelAtPeriodEnd = true;
    remote.cancelAt = remote.currentPeriodEnd;

    await syncSubscription(h.c, h.fake.provider, subscriptionId);
    await h.drainQueue();

    const stored = await local(subscriptionId);
    expect(subscriptionDisplayState(stored)).toBe("cancellation_scheduled");
    expect(stored.paidThrough).toEqual(before.paidThrough);
    expect((await h.access(user.id))[0].accessUntil).toEqual(
      before.paidThrough,
    );
  });

  it("ends access when the subscription ends", async () => {
    const { subscriptionId, user } = await subscribe();
    const remote = must(h.fake.subscriptions.get(subscriptionId));
    const endedAt = new Date(Date.now() + DAY);
    remote.status = "canceled";
    remote.providerStatus = "canceled";
    remote.endedAt = endedAt;

    await syncSubscription(h.c, h.fake.provider, subscriptionId);
    await h.drainQueue();

    const stored = await local(subscriptionId);
    expect(subscriptionDisplayState(stored)).toBe("ended");
    expect(stored.nextCheckAt).toBeNull();
    expect((await h.access(user.id))[0].accessUntil).toEqual(endedAt);
  });

  it("never brings an ended subscription back from a stale read", async () => {
    const { subscriptionId } = await subscribe();
    const remote = must(h.fake.subscriptions.get(subscriptionId));
    remote.status = "canceled";
    remote.providerStatus = "canceled";
    remote.endedAt = new Date();
    await syncSubscription(h.c, h.fake.provider, subscriptionId);

    remote.status = "active";
    remote.providerStatus = "active";
    remote.endedAt = null;
    await syncSubscription(h.c, h.fake.provider, subscriptionId);

    expect((await local(subscriptionId)).status).toBe("canceled");
  });

  it("keeps a newer sync when an older read finishes last", async () => {
    const { subscriptionId } = await subscribe();
    const newer = new Date(Date.now() + 60_000);
    await h.database.db
      .update(core_payments_subscriptions)
      .set({ syncedAt: newer })
      .where(eq(core_payments_subscriptions.externalId, subscriptionId));
    const remote = must(h.fake.subscriptions.get(subscriptionId));
    remote.cancelAtPeriodEnd = true;

    await syncSubscription(h.c, h.fake.provider, subscriptionId);

    expect(await local(subscriptionId)).toMatchObject({
      cancelAtPeriodEnd: false,
      syncedAt: newer,
    });
  });

  it("flags a second provider subscription for the same purchase", async () => {
    const { purchase, subscriptionId } = await subscribe();
    const extra = {
      ...must(h.fake.subscriptions.get(subscriptionId)),
      id: `${subscriptionId}_extra`,
      latestInvoiceId: null,
    };
    h.fake.subscriptions.set(extra.id, extra);

    await expect(
      syncSubscription(h.c, h.fake.provider, extra.id),
    ).rejects.toThrow(/second subscription/);

    const [stored] = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchase.id));
    expect(stored.lastError).toMatch(extra.id);
    expect((await local(subscriptionId)).status).toBe("active");
    expect(
      await h.database.db
        .select()
        .from(core_payments_subscriptions)
        .where(eq(core_payments_subscriptions.externalId, extra.id)),
    ).toHaveLength(0);
  });

  it("refuses a second subscription to the same plan, even concurrently", async () => {
    const user = await h.createUser();
    const request = {
      currency: "PLN",
      interval: "month" as const,
      offerId: "plan",
      pluginId: TEST_PLUGIN_ID,
    };

    await Promise.allSettled(
      Array.from({ length: 4 }, async () => {
        await startCheckout(h.forkContext(), user, request);
      }),
    );
    const purchases = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.userId, user.id));
    expect(purchases).toHaveLength(1);

    const checkout = must(
      [...h.fake.checkouts.values()].find(
        item => item.reference === purchases[0].publicId,
      ),
    );
    h.fake.complete(checkout.id);
    await refreshPurchase(h.c, h.fake.provider, purchases[0]);

    expect(
      await errorCode(
        startCheckout(h.c, user, { ...request, interval: "year" }),
      ),
    ).toBe("already_subscribed");
  });

  it("keeps existing subscribers on their price when the offer is repriced", async () => {
    const { subscriptionId } = await subscribe("month", "repriced");
    (repricedPlan.intervals.month as Record<string, number>).PLN = 2500;

    await syncSubscription(h.c, h.fake.provider, subscriptionId);
    const newcomer = await h.createUser();
    const { purchase } = await startCheckout(h.c, newcomer, {
      currency: "PLN",
      interval: "month",
      offerId: "repriced",
      pluginId: TEST_PLUGIN_ID,
    });

    expect((await local(subscriptionId)).amount).toBe(1900);
    expect(purchase.amount).toBe(2500);
  });

  it("records an invoice that arrives before its checkout was processed", async () => {
    const user = await h.createUser();
    const { purchase } = await startCheckout(h.c, user, {
      currency: "USD",
      interval: "month",
      offerId: "plan",
      pluginId: TEST_PLUGIN_ID,
    });
    const checkout = must(
      [...h.fake.checkouts.values()].find(
        item => item.reference === purchase.publicId,
      ),
    );
    const { invoiceId, subscriptionId } = h.fake.complete(checkout.id);

    await syncInvoice(h.c, h.fake.provider, must(invoiceId), "paid");

    expect((await local(must(subscriptionId))).paidThrough).not.toBeNull();
    const [row] = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchase.id));
    expect(row.paymentStatus).toBe("paid");
  });

  it("catches a renewal whose webhook never arrived", async () => {
    const { subscriptionId, user } = await subscribe();
    const invoiceId = h.fake.renew(subscriptionId, "paid");
    const renewedEnd = must(h.fake.invoices.get(invoiceId)).periodEnd;
    await h.database.db
      .update(core_payments_subscriptions)
      .set({ nextCheckAt: new Date(Date.now() - 1000) })
      .where(eq(core_payments_subscriptions.externalId, subscriptionId));

    const report = await reconcilePayments(h.c);
    await h.drainQueue();

    expect(report?.subscriptions).toBeGreaterThanOrEqual(1);
    expect((await local(subscriptionId)).paidThrough).toEqual(renewedEnd);
    expect((await h.access(user.id))[0].accessUntil).toEqual(renewedEnd);
  });

  it("expires an abandoned checkout during reconciliation", async () => {
    const user = await h.createUser();
    const { purchase } = await startCheckout(h.c, user, {
      currency: "PLN",
      interval: null,
      offerId: "lifetime",
      pluginId: TEST_PLUGIN_ID,
    });
    const checkout = must(
      [...h.fake.checkouts.values()].find(
        item => item.reference === purchase.publicId,
      ),
    );
    h.fake.expireCheckout(checkout.id);
    await h.database.db
      .update(core_payments_purchases)
      .set({ nextCheckAt: new Date(Date.now() - 1000) })
      .where(eq(core_payments_purchases.id, purchase.id));

    await reconcilePayments(h.c);

    const [row] = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, purchase.id));
    expect(row).toMatchObject({ nextCheckAt: null, paymentStatus: "expired" });
  });

  it("opens the billing portal only for the user's own customer", async () => {
    const { user } = await subscribe();
    const stranger = await h.createUser();

    const url = await createPortalSession(h.c, user.id, {
      returnPath: "/settings/billing",
    });
    expect(url).toContain(`cus_${user.id}`);
    expect(new URL(url).searchParams.get("return")).toBe(
      "http://localhost:3000/settings/billing",
    );

    expect(
      await errorCode(
        createPortalSession(h.c, stranger.id, {
          returnPath: "/settings/billing",
        }),
      ),
    ).toBe("no_billing_account");
  });
});
