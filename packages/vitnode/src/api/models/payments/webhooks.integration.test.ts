import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @vitest-environment node
import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { ProviderWebhookEvent } from "@/payments/provider";

import { webhookRoute } from "@/api/modules/payments/routes/webhook.route";
import {
  core_payments_fulfillments,
  core_payments_purchases,
  core_payments_webhook_events,
} from "@/database/payments";
import { core_queue } from "@/database/queue";
import {
  createPaymentsHarness,
  must,
  type PaymentsHarness,
  TEST_PLUGIN_ID,
} from "@/tests/payments";
import { describePostgres } from "@/tests/postgres";

import { startCheckout } from "./checkout";
import { retryFulfillment } from "./fulfillment";
import { refreshPurchase } from "./sync";
import { acceptWebhookEvent, processWebhookEvent } from "./webhooks";

let eventSeq = 0;

describePostgres("webhook ingestion", () => {
  let h: PaymentsHarness;
  let app: OpenAPIHono<EnvVitNode>;
  let failDispatch = false;

  beforeAll(async () => {
    h = await createPaymentsHarness();
    app = new OpenAPIHono<EnvVitNode>();
    app.use(
      "*",
      h.middleware({
        queue: () =>
          failDispatch
            ? {
                dispatch: async () =>
                  await Promise.reject(new Error("queue down")),
              }
            : undefined,
      }),
    );
    app.openapi(webhookRoute.route, webhookRoute.handler);
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  /** Everything queued has run, including the route's own best-effort kick. */
  const settle = async () => {
    for (let round = 0; round < 50; round++) {
      await h.drainQueue();
      const busy = await h.database.db
        .select({ id: core_queue.id })
        .from(core_queue)
        .where(inArray(core_queue.status, ["pending", "processing"]));
      if (busy.length === 0) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };

  const deliver = async (
    event: Partial<ProviderWebhookEvent> & Pick<ProviderWebhookEvent, "target">,
    { signature = "valid" }: { signature?: string } = {},
  ) => {
    eventSeq += 1;
    const full: ProviderWebhookEvent = {
      id: `evt_${eventSeq}`,
      scope: "test",
      type: "checkout.session.completed",
      ...event,
    };
    h.fake.nextWebhook(full);

    const response = await app.request("/webhooks/fake", {
      body: JSON.stringify({ id: full.id }),
      headers: {
        "content-type": "application/json",
        "x-fake-signature": signature,
      },
      method: "POST",
    });

    return { event: full, response };
  };

  const paidPurchase = async (
    outcome: "failed" | "paid" | "unpaid" = "paid",
  ) => {
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
    h.fake.complete(checkout.id, outcome);

    return { checkoutId: checkout.id, purchase, user };
  };

  const purchaseRow = async (id: number) =>
    (
      await h.database.db
        .select()
        .from(core_payments_purchases)
        .where(eq(core_payments_purchases.id, id))
    )[0];

  it("rejects an invalid signature and stores nothing", async () => {
    const before = await h.database.db
      .select()
      .from(core_payments_webhook_events);
    const { response } = await deliver(
      { target: { id: "cs_x", kind: "checkout" } },
      { signature: "forged" },
    );

    expect(response.status).toBe(400);
    expect(
      await h.database.db.select().from(core_payments_webhook_events),
    ).toHaveLength(before.length);
  });

  it("answers 404 for a provider that is not configured", async () => {
    const response = await app.request("/webhooks/paypal", {
      body: "{}",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(404);
  });

  it("refuses a body larger than any provider event", async () => {
    const response = await app.request("/webhooks/fake", {
      body: "x".repeat(600 * 1024),
      headers: {
        "content-type": "application/json",
        "x-fake-signature": "valid",
      },
      method: "POST",
    });

    expect(response.status).toBe(413);
  });

  it("acknowledges an event type it does not use without storing it", async () => {
    const { response } = await deliver({
      target: null,
      type: "customer.created",
    });

    expect(await response.json()).toEqual({ ignored: true, received: true });
  });

  it("stores the event and its queue job before acknowledging", async () => {
    const { checkoutId } = await paidPurchase();
    const { event, response } = await deliver({
      target: { id: checkoutId, kind: "checkout" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });

    const [stored] = await h.database.db
      .select()
      .from(core_payments_webhook_events)
      .where(eq(core_payments_webhook_events.externalId, event.id));
    expect(stored.target).toEqual({ id: checkoutId, kind: "checkout" });
    await settle();
  });

  it("does not acknowledge an event it could not store durably", async () => {
    failDispatch = true;
    try {
      const { event, response } = await deliver({
        target: { id: "cs_unstored", kind: "checkout" },
      });

      expect(response.status).toBe(500);
      // The inbox insert rolled back together with the failed dispatch.
      expect(
        await h.database.db
          .select()
          .from(core_payments_webhook_events)
          .where(eq(core_payments_webhook_events.externalId, event.id)),
      ).toEqual([]);
    } finally {
      failDispatch = false;
    }
  });

  it("acknowledges a repeated delivery without queueing it again", async () => {
    const { checkoutId } = await paidPurchase();
    const event: ProviderWebhookEvent = {
      id: "evt_repeat",
      scope: "test",
      target: { id: checkoutId, kind: "checkout" },
      type: "checkout.session.completed",
    };

    const first = await acceptWebhookEvent(h.c, h.fake.provider, {
      ...event,
      target: { id: checkoutId, kind: "checkout" },
    });
    h.fake.nextWebhook(event);
    const repeated = await app.request("/webhooks/fake", {
      body: "{}",
      headers: {
        "content-type": "application/json",
        "x-fake-signature": "valid",
      },
      method: "POST",
    });

    expect(first.status).toBe("accepted");
    expect(await repeated.json()).toEqual({ duplicate: true, received: true });
    expect(
      await h.database.db
        .select()
        .from(core_queue)
        .where(eq(core_queue.name, "payments-process-event")),
    ).toHaveLength(
      (await h.database.db.select().from(core_payments_webhook_events)).length,
    );
    await settle();
  });

  it("grants once when two different events report the same payment", async () => {
    const { checkoutId, purchase, user } = await paidPurchase();

    await deliver({ target: { id: checkoutId, kind: "checkout" } });
    await deliver({
      target: { id: checkoutId, kind: "checkout" },
      type: "checkout.session.async_payment_succeeded",
    });
    await settle();

    expect(await h.access(user.id)).toHaveLength(1);
    expect(
      h.handlerCalls.filter(
        call => call.kind === "paid" && call.purchaseId === purchase.publicId,
      ),
    ).toHaveLength(1);
    expect((await purchaseRow(purchase.id)).fulfillmentStatus).toBe(
      "fulfilled",
    );
  });

  it("settles an asynchronous payment and ignores the older snapshot", async () => {
    const { checkoutId, purchase, user } = await paidPurchase("unpaid");

    await deliver({ target: { id: checkoutId, kind: "checkout" } });
    await settle();
    expect((await purchaseRow(purchase.id)).paymentStatus).toBe("processing");
    expect(await h.access(user.id)).toEqual([]);

    must(h.fake.checkouts.get(checkoutId)).paymentStatus = "paid";
    await deliver({
      target: { id: checkoutId, kind: "checkout" },
      type: "checkout.session.async_payment_succeeded",
    });
    await settle();
    expect((await purchaseRow(purchase.id)).paymentStatus).toBe("paid");

    // The provider briefly reports the earlier state again - nothing moves back.
    must(h.fake.checkouts.get(checkoutId)).paymentStatus = "unpaid";
    await deliver({ target: { id: checkoutId, kind: "checkout" } });
    await settle();
    expect((await purchaseRow(purchase.id)).paymentStatus).toBe("paid");
    expect(await h.access(user.id)).toHaveLength(1);
  });

  it("fails a declined asynchronous payment without granting", async () => {
    const { checkoutId, purchase, user } = await paidPurchase("failed");

    await deliver({
      target: { id: checkoutId, kind: "checkout" },
      type: "checkout.session.async_payment_failed",
    });
    await settle();

    expect((await purchaseRow(purchase.id)).paymentStatus).toBe("failed");
    expect(await h.access(user.id)).toEqual([]);
  });

  it("processes events in any order because it re-reads the provider", async () => {
    const { checkoutId, purchase } = await paidPurchase();

    // "expired" arrives last but the provider says the checkout completed.
    await deliver({
      target: { id: checkoutId, kind: "checkout" },
      type: "checkout.session.async_payment_succeeded",
    });
    await deliver({
      target: { id: checkoutId, kind: "checkout" },
      type: "checkout.session.expired",
    });
    await settle();

    expect((await purchaseRow(purchase.id)).paymentStatus).toBe("paid");
  });

  it("does not mark a purchase paid because the buyer was redirected back", async () => {
    const user = await h.createUser();
    const { purchase } = await startCheckout(h.c, user, {
      currency: "USD",
      interval: null,
      offerId: "lifetime",
      pluginId: TEST_PLUGIN_ID,
    });

    // The status refresh asks the provider; the checkout is still open.
    const refreshed = await refreshPurchase(h.c, h.fake.provider, purchase);

    expect(refreshed.paymentStatus).toBe("awaiting_payment");
  });

  it("records an event for an unknown checkout as a permanent failure", async () => {
    const event = await acceptWebhookEvent(h.c, h.fake.provider, {
      id: "evt_unknown",
      scope: "test",
      target: { id: "cs_missing", kind: "checkout" },
      type: "checkout.session.completed",
    });
    if (event.status !== "accepted") throw new Error("expected accepted");

    // Not found at the provider - retrying cannot help.
    await processWebhookEvent(h.c, event.eventId);
    const [stored] = await h.database.db
      .select()
      .from(core_payments_webhook_events)
      .where(eq(core_payments_webhook_events.id, event.eventId));

    expect(stored.status).toBe("failed");
    expect(stored.lastError).toMatch(/No such checkout/);
  });
});

describePostgres("fulfillment", () => {
  let h: PaymentsHarness;

  beforeAll(async () => {
    h = await createPaymentsHarness();
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const buy = async () => {
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
    h.fake.complete(checkout.id);

    return { checkout, purchase, user };
  };

  const row = async (id: number) =>
    (
      await h.database.db
        .select()
        .from(core_payments_purchases)
        .where(eq(core_payments_purchases.id, id))
    )[0];

  it("commits the paid state and the fulfillment job together", async () => {
    const { purchase } = await buy();
    const c = h.forkContext();
    c.set("queue", {
      dispatch: async () => await Promise.reject(new Error("queue down")),
    } as never);

    await expect(refreshPurchase(c, h.fake.provider, purchase)).rejects.toThrow(
      "queue down",
    );

    // Neither half survived: a paid purchase without its job cannot exist.
    expect((await row(purchase.id)).paymentStatus).toBe("awaiting_payment");
    expect(
      await h.database.db
        .select()
        .from(core_payments_fulfillments)
        .where(eq(core_payments_fulfillments.purchaseId, purchase.id)),
    ).toEqual([]);
  });

  it("keeps a payment paid when its handler fails, and grants once on retry", async () => {
    const { purchase, user } = await buy();
    h.setHandlerFailure(new Error("Plugin database is read-only"));

    await refreshPurchase(h.c, h.fake.provider, purchase);
    await h.drainQueue();

    const failed = await row(purchase.id);
    expect(failed.paymentStatus).toBe("paid");
    expect(failed.fulfillmentStatus).toBe("failed");
    // The handler's insert rolled back with its failure.
    expect(await h.access(user.id)).toEqual([]);

    h.setHandlerFailure(null);
    const [fulfillment] = await h.database.db
      .select()
      .from(core_payments_fulfillments)
      .where(eq(core_payments_fulfillments.purchaseId, purchase.id));

    expect(await retryFulfillment(h.c, fulfillment.id)).toBe(true);
    // A second click while the first retry is queued changes nothing.
    await h.drainQueue();
    expect(await retryFulfillment(h.c, fulfillment.id)).toBe(false);
    await h.drainQueue(new Date(Date.now() + 24 * 60 * 60 * 1000));

    expect((await row(purchase.id)).fulfillmentStatus).toBe("fulfilled");
    expect(await h.access(user.id)).toHaveLength(1);
  });

  it("makes a missing handler visible instead of granting something else", async () => {
    const { purchase } = await buy();
    await refreshPurchase(h.c, h.fake.provider, purchase);

    const c = h.forkContext();
    const core = c.get("core");
    c.set("core", {
      ...core,
      payments: { ...core.payments, offers: new Map() },
    });
    const { runFulfillment } = await import("./fulfillment");
    const [fulfillment] = await h.database.db
      .select()
      .from(core_payments_fulfillments)
      .where(eq(core_payments_fulfillments.purchaseId, purchase.id));

    expect(await runFulfillment(c, fulfillment.id)).toBe("failed");

    const after = await row(purchase.id);
    expect(after.paymentStatus).toBe("paid");
    expect(after.fulfillmentStatus).toBe("failed");
    expect(after.lastError).toMatch(/not registered/);
    await h.drainQueue();
  });

  it("revokes the one-time grant once on a full refund, not on a partial one", async () => {
    const { checkout, purchase, user } = await buy();
    await refreshPurchase(h.c, h.fake.provider, purchase);
    await h.drainQueue();
    const paymentId = `pi_${checkout.id}`;
    const { syncPayment } = await import("./sync");

    h.fake.refund(paymentId, 900);
    await syncPayment(h.c, h.fake.provider, paymentId);
    await h.drainQueue();

    const partial = await row(purchase.id);
    expect(partial).toMatchObject({
      amount: 1900,
      refundedAmount: 900,
      refundStatus: "partial",
    });
    expect(await h.access(user.id)).toHaveLength(1);

    h.fake.refund(paymentId, 1000);
    await syncPayment(h.c, h.fake.provider, paymentId);
    // The same facts reported again do not call the plugin again.
    await syncPayment(h.c, h.fake.provider, paymentId);
    await h.drainQueue();

    expect(await row(purchase.id)).toMatchObject({
      amount: 1900,
      paymentStatus: "paid",
      refundedAmount: 1900,
      refundStatus: "full",
    });
    expect(await h.access(user.id)).toEqual([]);
    expect(
      h.handlerCalls.filter(
        call =>
          call.kind === "refunded" && call.purchaseId === purchase.publicId,
      ),
    ).toHaveLength(2);
  });

  it("does not count a pending refund as refunded", async () => {
    const { checkout, purchase, user } = await buy();
    await refreshPurchase(h.c, h.fake.provider, purchase);
    await h.drainQueue();
    const paymentId = `pi_${checkout.id}`;
    const { syncPayment } = await import("./sync");

    h.fake.refund(paymentId, 1900, "pending");
    await syncPayment(h.c, h.fake.provider, paymentId);
    await h.drainQueue();

    expect((await row(purchase.id)).refundStatus).toBe("none");
    expect(await h.access(user.id)).toHaveLength(1);
  });
});

describe("webhook route contract", () => {
  it("is mounted without a request body schema, so the raw bytes reach the provider", () => {
    expect(webhookRoute.route.request).not.toHaveProperty("body");
  });
});
