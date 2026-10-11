// @vitest-environment node
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  core_payments_checkouts,
  core_payments_purchases,
} from "@/database/payments";
import { PaymentProviderError } from "@/payments/provider";
import {
  createPaymentsHarness,
  must,
  type PaymentsHarness,
  TEST_PLUGIN_ID,
} from "@/tests/payments";
import { describePostgres } from "@/tests/postgres";

import { cancelPurchase, startCheckout } from "./checkout";
import { applyCheckoutState, refreshPurchase } from "./sync";

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HTTPException) {
      return {
        status: error.status,
        ...(await error.getResponse().json()),
      } as {
        code: string;
        purchaseId?: string;
        status: number;
      };
    }
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

const lifetime = (currency = "PLN", idempotencyKey?: string) => ({
  currency,
  idempotencyKey,
  interval: null,
  offerId: "lifetime",
  pluginId: TEST_PLUGIN_ID,
});

describePostgres("checkout", () => {
  let h: PaymentsHarness;

  beforeAll(async () => {
    h = await createPaymentsHarness();
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  it("derives the price on the server and snapshots the offer", async () => {
    const user = await h.createUser();
    const { checkoutUrl, purchase } = await startCheckout(
      h.c,
      user,
      lifetime("USD"),
    );

    expect(checkoutUrl).toMatch(/^https:\/\/pay\.example\//);
    expect(purchase).toMatchObject({
      amount: 500,
      currency: "USD",
      offerName: "Lifetime supporter",
      paymentStatus: "awaiting_payment",
      userId: user.id,
    });

    const call = must(h.fake.createCalls.at(-1));
    expect(call.input.item).toEqual({
      amount: 500,
      currency: "USD",
      interval: undefined,
      name: "Lifetime supporter",
    });
    expect(call.input.reference).toBe(purchase.publicId);
    // Return URLs are built from the offer's path on the configured origin.
    expect(new URL(call.input.successUrl).pathname).toBe("/example/payments");
    expect(new URL(call.input.successUrl).searchParams.get("purchase")).toBe(
      purchase.publicId,
    );
  });

  it("refuses a currency the offer has no price in", async () => {
    const user = await h.createUser();

    expect(
      await errorOf(startCheckout(h.c, user, lifetime("JPY"))),
    ).toMatchObject({
      code: "currency_unavailable",
      status: 400,
    });
  });

  it("refuses an interval on a one-time offer", async () => {
    const user = await h.createUser();

    expect(
      await errorOf(
        startCheckout(h.c, user, { ...lifetime(), interval: "month" }),
      ),
    ).toMatchObject({ code: "interval_unavailable", status: 400 });
  });

  it("returns the same checkout for a duplicate click", async () => {
    const user = await h.createUser();
    const before = h.fake.createCalls.length;

    const first = await startCheckout(h.c, user, lifetime());
    const second = await startCheckout(h.c, user, lifetime());

    expect(second.purchase.id).toBe(first.purchase.id);
    expect(second.checkoutUrl).toBe(first.checkoutUrl);
    expect(h.fake.createCalls.length - before).toBe(1);
  });

  it("creates one purchase and one checkout for concurrent clicks", async () => {
    const user = await h.createUser();
    const before = h.fake.createCalls.length;
    const contexts = Array.from({ length: 5 }, () => h.forkContext());

    const results = await Promise.allSettled(
      contexts.map(async c => await startCheckout(c, user, lifetime())),
    );
    const purchases = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.userId, user.id));

    expect(purchases).toHaveLength(1);
    expect(
      new Set(h.fake.createCalls.slice(before).map(call => call.idempotencyKey))
        .size,
    ).toBe(1);
    for (const result of results) {
      // Every click either got the one checkout or was told to retry.
      if (result.status === "fulfilled") {
        expect(result.value.purchase.id).toBe(purchases[0].id);
      }
    }
  });

  it("refuses an idempotency key reused for a different request", async () => {
    const user = await h.createUser();
    await startCheckout(h.c, user, lifetime("PLN", "key-aaaaaaaa"));

    expect(
      await errorOf(startCheckout(h.c, user, lifetime("USD", "key-aaaaaaaa"))),
    ).toMatchObject({ code: "idempotency_conflict", status: 409 });
  });

  it("scopes idempotency keys to the buyer", async () => {
    const alice = await h.createUser();
    const bob = await h.createUser();

    const a = await startCheckout(h.c, alice, lifetime("PLN", "shared-key-1"));
    const b = await startCheckout(h.c, bob, lifetime("USD", "shared-key-1"));

    expect(b.purchase.id).not.toBe(a.purchase.id);
    expect(b.purchase.userId).toBe(bob.id);
  });

  it("recovers from a timeout without creating a second checkout", async () => {
    const user = await h.createUser();
    h.fake.failNext(
      "create:lost",
      new PaymentProviderError("uncertain", "Socket hang up"),
    );

    expect(
      await errorOf(startCheckout(h.c, user, lifetime("PLN", "retry-key-1"))),
    ).toMatchObject({ code: "checkout_uncertain", status: 503 });

    const [unknown] = await h.database.db
      .select()
      .from(core_payments_checkouts)
      .innerJoin(
        core_payments_purchases,
        eq(core_payments_purchases.id, core_payments_checkouts.purchaseId),
      )
      .where(eq(core_payments_purchases.userId, user.id));
    expect(unknown.core_payments_checkouts.status).toBe("unknown");

    const retried = await startCheckout(
      h.c,
      user,
      lifetime("PLN", "retry-key-1"),
    );
    const calls = h.fake.createCalls.filter(
      call => call.input.reference === retried.purchase.publicId,
    );

    expect(retried.checkoutUrl).toMatch(/pay\.example/);
    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyKey).toBe(calls[1].idempotencyKey);
    expect(
      [...h.fake.checkouts.values()].filter(
        checkout => checkout.reference === retried.purchase.publicId,
      ),
    ).toHaveLength(1);
  });

  it("marks a refused checkout failed and lets the next click try again", async () => {
    const user = await h.createUser();
    h.fake.failNext(
      "create",
      new PaymentProviderError("rejected", "Invalid currency"),
    );

    expect(await errorOf(startCheckout(h.c, user, lifetime()))).toMatchObject({
      code: "checkout_failed",
      status: 502,
    });

    const retried = await startCheckout(h.c, user, lifetime());
    const attempts = await h.database.db
      .select({ status: core_payments_checkouts.status })
      .from(core_payments_checkouts)
      .where(eq(core_payments_checkouts.purchaseId, retried.purchase.id));

    expect(attempts.map(attempt => attempt.status).sort()).toEqual([
      "failed",
      "open",
    ]);
  });

  it("starts a new purchase once the previous checkout expired", async () => {
    const user = await h.createUser();
    const first = await startCheckout(h.c, user, lifetime());
    const checkoutId = must(h.fake.createCalls.at(-1));
    const [stored] = await h.database.db
      .select()
      .from(core_payments_checkouts)
      .where(eq(core_payments_checkouts.purchaseId, first.purchase.id));

    h.fake.expireCheckout(must(stored.externalId));
    await h.database.db
      .update(core_payments_checkouts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(core_payments_checkouts.id, stored.id));

    const second = await startCheckout(h.c, user, lifetime());
    const [old] = await h.database.db
      .select()
      .from(core_payments_purchases)
      .where(eq(core_payments_purchases.id, first.purchase.id));

    expect(checkoutId.input.reference).toBe(first.purchase.publicId);
    expect(old.paymentStatus).toBe("expired");
    expect(second.purchase.id).not.toBe(first.purchase.id);
    expect(second.checkoutUrl).toMatch(/pay\.example/);
  });

  it("refuses a second checkout in another currency while one is open", async () => {
    const user = await h.createUser();
    const open = await startCheckout(h.c, user, lifetime("PLN"));

    expect(
      await errorOf(startCheckout(h.c, user, lifetime("USD"))),
    ).toMatchObject({
      code: "checkout_in_progress",
      purchaseId: open.purchase.publicId,
      status: 409,
    });

    await cancelPurchase(h.c, open.purchase);
    const switched = await startCheckout(h.c, user, lifetime("USD"));

    expect(switched.purchase.currency).toBe("USD");
  });

  it("lets a payment that landed win over a cancel", async () => {
    const user = await h.createUser();
    const { purchase } = await startCheckout(h.c, user, lifetime());
    const checkoutId = must(
      [...h.fake.checkouts.values()].find(
        checkout => checkout.reference === purchase.publicId,
      ),
    ).id;
    h.fake.complete(checkoutId);

    const result = await cancelPurchase(h.c, purchase);

    expect(result.paymentStatus).toBe("paid");
  });

  it("refuses an ineligible buyer on the server", async () => {
    const user = await h.createUser();
    const { purchase } = await startCheckout(h.c, user, lifetime());
    const checkout = must(
      [...h.fake.checkouts.values()].find(
        item => item.reference === purchase.publicId,
      ),
    );
    h.fake.complete(checkout.id);
    await refreshPurchase(h.c, h.fake.provider, purchase);
    await h.drainQueue();

    expect(await errorOf(startCheckout(h.c, user, lifetime()))).toMatchObject({
      code: "not_eligible",
      status: 409,
    });
  });

  it("closes a checkout about to expire before opening the next one", async () => {
    const user = await h.createUser();
    const first = await startCheckout(h.c, user, lifetime());
    const [old] = await h.database.db
      .select()
      .from(core_payments_checkouts)
      .where(eq(core_payments_checkouts.purchaseId, first.purchase.id));
    await h.database.db
      .update(core_payments_checkouts)
      .set({ expiresAt: new Date(Date.now() + 60_000) })
      .where(eq(core_payments_checkouts.id, old.id));

    const second = await startCheckout(h.c, user, lifetime());
    const oldId = must(old.externalId);

    expect(second.purchase.id).toBe(first.purchase.id);
    expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
    expect(must(h.fake.checkouts.get(oldId)).status).toBe("expired");

    // The old session's "expired" webhook lands after the new one opened.
    const applied = await applyCheckoutState(
      h.c,
      h.fake.provider,
      await h.fake.provider.checkout.retrieve(oldId),
    );

    expect(applied.purchase.paymentStatus).toBe("awaiting_payment");
    expect(await startCheckout(h.c, user, lifetime())).toMatchObject({
      checkoutUrl: second.checkoutUrl,
    });
  });

  it("reuses one billing customer per user", async () => {
    const user = await h.createUser();
    await startCheckout(h.c, user, lifetime("PLN"));
    await startCheckout(h.c, user, {
      ...lifetime("PLN"),
      interval: "month",
      offerId: "plan",
    });

    expect(
      h.fake.customerCalls.filter(call => call.userId === user.id),
    ).toHaveLength(1);
  });
});

describePostgres("checkout with Payments disabled", () => {
  let h: PaymentsHarness;

  beforeAll(async () => {
    h = await createPaymentsHarness({ payments: false });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  it("answers that Payments is disabled", async () => {
    const user = await h.createUser();

    expect(await errorOf(startCheckout(h.c, user, lifetime()))).toMatchObject({
      code: "payments_disabled",
      status: 503,
    });
  });
});

describe("startCheckout input", () => {
  it("has no field for a price, a buyer or a URL", () => {
    // The type is the contract: anything authoritative is resolved server-side.
    const request: Parameters<typeof startCheckout>[2] = lifetime();

    expect(Object.keys(request).sort()).toEqual([
      "currency",
      "idempotencyKey",
      "interval",
      "offerId",
      "pluginId",
    ]);
  });
});
