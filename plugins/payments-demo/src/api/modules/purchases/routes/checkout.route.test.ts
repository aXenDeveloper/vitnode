import type { PaymentErrorCode } from "@vitnode/core/api/lib/payments/errors";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { PaymentError } from "@vitnode/core/api/lib/payments/errors";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkoutRoute } from "./checkout.route";

const db = {
  insert: () => ({ values: () => ({ onConflictDoNothing: async () => {} }) }),
  select: () => ({
    from: () => ({
      where: () => ({ limit: async () => await Promise.resolve([{ id: 1 }]) }),
    }),
  }),
};

const request = async ({
  createCheckout = async () =>
    await Promise.resolve({
      expiresAt: new Date("2026-11-11T13:00:00Z"),
      paymentId: "pay_1",
      redirectUrl: "https://checkout.example.test/session",
      resumed: false,
    }),
  owned = false,
  signedIn = true,
}: {
  createCheckout?: () => Promise<unknown>;
  owned?: boolean;
  signedIn?: boolean;
} = {}) => {
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    if (signedIn) {
      c.set("user", { id: 7 } as unknown as Context["var"]["user"]);
    }
    c.set("db", db as unknown as Context["var"]["db"]);
    c.set("payments", {
      createCheckout,
      listByReference: async () =>
        await Promise.resolve(owned ? [{ status: "succeeded" }] : []),
    } as unknown as Context["var"]["payments"]);
    await next();
  });
  app.openapi(checkoutRoute.route, checkoutRoute.handler);

  return await app.request("/checkout", {
    body: JSON.stringify({ itemId: "sticker-pack", providerId: "stripe-main" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /checkout", () => {
  it("answers 401 to a guest", async () => {
    expect((await request({ signedIn: false })).status).toBe(401);
  });

  it("answers 200 with where to send the browser", async () => {
    const res = await request();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      paymentId: "pay_1",
      purchaseId: 1,
      redirectUrl: "https://checkout.example.test/session",
    });
  });

  it("answers 409 already_owned for a paid purchase", async () => {
    const res = await request({ owned: true });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "already_owned" });
  });

  it.each<[PaymentErrorCode, number]>([
    ["provider_not_found", 400],
    ["invalid_return_path", 400],
    ["already_paid", 409],
    ["payment_in_progress", 409],
    ["provider_rejected", 502],
    ["provider_unavailable", 503],
  ])("answers %s with %i", async (code, status) => {
    const res = await request({
      createCheckout: async () => await Promise.reject(new PaymentError(code)),
    });

    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({ error: code });
  });

  it.each([
    [
      "a refusal the route has no answer for",
      new PaymentError("payment_not_found"),
    ],
    ["an unexpected error", new Error("database went away")],
  ])("answers 500 to %s", async (_label, error) => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request({
      createCheckout: async () => await Promise.reject(error),
    });

    expect(res.status).toBe(500);
  });
});
