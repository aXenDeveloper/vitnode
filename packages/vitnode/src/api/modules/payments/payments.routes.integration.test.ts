import { OpenAPIHono } from "@hono/zod-openapi";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @vitest-environment node
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { paymentsAdminModule } from "@/api/modules/admin/payments/payments.admin.module";
import {
  createPaymentsHarness,
  must,
  type PaymentsHarness,
  TEST_PLUGIN_ID,
} from "@/tests/payments";
import { describePostgres } from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { paymentsModule } from "./payments.module";

interface Buyer {
  email: string;
  id: number;
  language: string;
  name: string;
}

describePostgres("payments routes", () => {
  let h: PaymentsHarness;
  let app: OpenAPIHono<EnvVitNode>;
  let signedIn: Buyer | null = null;
  let admin: null | { id: number } = null;

  beforeAll(async () => {
    h = await createPaymentsHarness();
    app = new OpenAPIHono<EnvVitNode>();
    app.use("*", h.middleware({ admin: () => admin, user: () => signedIn }));
    app.route("/payments", paymentsModule.hono);
    app.route("/admin/payments", paymentsAdminModule.hono);
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const as = (user: Buyer | null) => {
    signedIn = user;
  };

  const post = async (path: string, body: unknown) =>
    await app.request(path, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  const buy = async (user: Buyer, currency = "PLN") => {
    as(user);
    const response = await post("/payments/checkout", {
      currency,
      offerId: "lifetime",
      pluginId: TEST_PLUGIN_ID,
    });

    return (await response.json()) as {
      checkoutUrl: null | string;
      purchase: { amount: number; id: string };
    };
  };

  describe("settings", () => {
    it("publishes what the UI needs and no credential", async () => {
      const response = await app.request("/payments/settings");
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(JSON.parse(text)).toMatchObject({
        defaultCurrency: "PLN",
        enabled: true,
      });
      // Nothing an adapter keeps internally is part of the projection.
      expect(text).not.toMatch(/sk_|whsec_|secret/i);
    });

    it("lists only purchasable prices for a plugin's offers", async () => {
      const response = await app.request(
        `/payments/offers?pluginId=${encodeURIComponent(TEST_PLUGIN_ID)}`,
      );
      const body = (await response.json()) as {
        offers: { id: string; prices: { currency: string }[] }[];
      };
      const lifetime = must(body.offers.find(offer => offer.id === "lifetime"));

      expect(lifetime.prices.map(price => price.currency).sort()).toEqual([
        "EUR",
        "PLN",
        "USD",
      ]);
    });
  });

  describe("checkout", () => {
    it("requires a signed-in buyer", async () => {
      as(null);
      const response = await post("/payments/checkout", {
        currency: "PLN",
        offerId: "lifetime",
        pluginId: TEST_PLUGIN_ID,
      });

      expect(response.status).toBe(401);
    });

    it("ignores a price sent by the browser", async () => {
      const user = await h.createUser();
      as(user);
      const response = await post("/payments/checkout", {
        amount: 1,
        currency: "PLN",
        offerId: "lifetime",
        pluginId: TEST_PLUGIN_ID,
        userId: 999,
      });
      const body = (await response.json()) as { purchase: { amount: number } };

      expect(response.status).toBe(200);
      expect(body.purchase.amount).toBe(1900);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    });
  });

  describe("ownership", () => {
    it("shows a purchase only to its buyer", async () => {
      const alice = await h.createUser();
      const bob = await h.createUser();
      const { purchase } = await buy(alice);

      as(bob);
      const asBob = await app.request(`/payments/purchases/${purchase.id}`);
      expect(asBob.status).toBe(404);

      as(alice);
      const asAlice = await app.request(`/payments/purchases/${purchase.id}`);
      expect(asAlice.status).toBe(200);
      expect(asAlice.headers.get("cache-control")).toBe("private, no-store");
    });

    it("lists only the signed-in user's purchases", async () => {
      const alice = await h.createUser();
      const bob = await h.createUser();
      await buy(alice);

      as(bob);
      const response = await app.request("/payments/purchases");
      const body = (await response.json()) as { edges: unknown[] };

      expect(body.edges).toEqual([]);
    });

    it("refuses to cancel someone else's checkout", async () => {
      const alice = await h.createUser();
      const bob = await h.createUser();
      const { purchase } = await buy(alice, "USD");

      as(bob);
      const response = await post(
        `/payments/purchases/${purchase.id}/cancel`,
        {},
      );

      expect(response.status).toBe(404);
    });

    it("never opens another user's billing portal", async () => {
      const alice = await h.createUser();
      const bob = await h.createUser();
      await buy(alice, "EUR");

      as(bob);
      const response = await post("/payments/portal", {});

      expect(response.status).toBe(404);
      expect(((await response.json()) as { code: string }).code).toBe(
        "no_billing_account",
      );
    });

    it("refuses a portal return URL from the request", async () => {
      const alice = await h.createUser();
      await buy(alice, "EUR");
      as(alice);

      const response = await post("/payments/portal", {
        returnTo: "https://evil.example/phish",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("returning from checkout", () => {
    it("learns the outcome from the provider before any webhook", async () => {
      const user = await h.createUser();
      const { purchase } = await buy(user, "USD");
      const checkout = must(
        [...h.fake.checkouts.values()].find(
          item => item.reference === purchase.id,
        ),
      );
      h.fake.complete(checkout.id);

      as(user);
      const without = await app.request(`/payments/purchases/${purchase.id}`);
      const withRefresh = await app.request(
        `/payments/purchases/${purchase.id}?refresh=true`,
      );

      expect(
        ((await without.json()) as { purchase: { paymentStatus: string } })
          .purchase.paymentStatus,
      ).toBe("awaiting_payment");
      expect(
        ((await withRefresh.json()) as { purchase: { paymentStatus: string } })
          .purchase.paymentStatus,
      ).toBe("paid");
      await h.drainQueue();
    });
  });

  describe("AdminCP", () => {
    const grant = async (permissions: string[]) => {
      const staff = await h.createUser();
      await grantStaffPermissions(h.c.get("cache"), {
        permissions: permissions.map(permission => ({
          module: "payments",
          permission,
          plugin: "@vitnode/core",
        })),
        userId: staff.id,
      });
      admin = { id: staff.id };
    };

    it("refuses an administrator without the payments permission", async () => {
      await grant([]);

      expect((await app.request("/admin/payments/overview")).status).toBe(403);
      expect((await app.request("/admin/payments/purchases")).status).toBe(403);
    });

    it("keeps revenue separate per currency", async () => {
      const user = await h.createUser();
      const { purchase } = await buy(user, "EUR");
      const checkout = must(
        [...h.fake.checkouts.values()].find(
          item => item.reference === purchase.id,
        ),
      );
      h.fake.complete(checkout.id);
      as(user);
      await app.request(`/payments/purchases/${purchase.id}?refresh=true`);
      await grant(["can_view"]);

      const response = await app.request("/admin/payments/overview");
      const body = (await response.json()) as {
        totals: { currency: string; oneTime: number }[];
      };

      expect(response.status).toBe(200);
      expect(body.totals.map(total => total.currency)).toEqual(
        [...new Set(body.totals.map(total => total.currency))].sort(),
      );
      expect(
        must(body.totals.find(total => total.currency === "EUR")).oneTime,
      ).toBe(450);
      await h.drainQueue();
    });

    it("filters purchases by currency and status", async () => {
      await grant(["can_view"]);

      const response = await app.request(
        "/admin/payments/purchases?currency=EUR&status=paid",
      );
      const body = (await response.json()) as {
        edges: { currency: string; paymentStatus: string }[];
      };

      expect(body.edges.length).toBeGreaterThan(0);
      expect(
        body.edges.every(
          edge => edge.currency === "EUR" && edge.paymentStatus === "paid",
        ),
      ).toBe(true);
    });

    it("needs the retry permission to retry, and says when there is nothing to retry", async () => {
      await grant(["can_view"]);
      expect(
        (await post("/admin/payments/fulfillments/1/retry", {})).status,
      ).toBe(403);

      await grant(["can_view", "can_retry"]);
      const response = await post(
        "/admin/payments/fulfillments/999999/retry",
        {},
      );
      expect(response.status).toBe(409);
    });
  });
});
