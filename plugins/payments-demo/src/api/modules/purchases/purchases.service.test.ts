import type { PaymentErrorCode } from "@vitnode/core/api/lib/payments/errors";
import type { Payment } from "@vitnode/core/api/models/payments";

import { PaymentError } from "@vitnode/core/api/lib/payments/errors";
import { describe, expect, it, vi } from "vitest";

import type { PurchasesServiceDeps } from "./purchases.service";

import { createPurchasesService } from "./purchases.service";

interface PurchaseRow {
  id: number;
  itemId: string;
  userId: number;
}

const createPurchasesDb = () => {
  const rows: PurchaseRow[] = [];
  let last: Omit<PurchaseRow, "id"> | undefined;
  const matching = () =>
    rows.filter(
      row => row.userId === last?.userId && row.itemId === last.itemId,
    );

  const db = {
    insert: () => ({
      values: (values: Omit<PurchaseRow, "id">) => {
        last = values;

        return {
          onConflictDoNothing: async () => {
            if (matching().length === 0) {
              rows.push({ id: rows.length + 1, ...values });
            }
            await Promise.resolve();
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            await Promise.resolve(matching().map(({ id }) => ({ id }))),
        }),
      }),
    }),
  };

  return { db: db as unknown as PurchasesServiceDeps["db"], rows };
};

const createFakePayments = (attempts: Pick<Payment, "status">[] = []) => ({
  createCheckout: vi.fn<PurchasesServiceDeps["payments"]["createCheckout"]>(
    async ({ reference }) =>
      await Promise.resolve({
        expiresAt: new Date("2026-11-11T13:00:00Z"),
        paymentId: `pay_${reference}`,
        redirectUrl: "https://checkout.example.test/session",
        resumed: false,
      }),
  ),
  listByReference: vi.fn<PurchasesServiceDeps["payments"]["listByReference"]>(
    async () => await Promise.resolve(attempts as Payment[]),
  ),
});

const ACTOR = { id: 7 };
const input = {
  actor: ACTOR,
  itemId: "sticker-pack",
  providerId: "stripe-main",
} as const;

describe("createPurchasesService().checkout", () => {
  it("stores the purchase and charges the catalog price, whatever the caller sends", async () => {
    const { db, rows } = createPurchasesDb();
    const payments = createFakePayments();
    const tampered = { ...input, amount: 1, currency: "eur" };

    const result = await createPurchasesService({ db, payments }).checkout(
      tampered,
    );

    expect(result).toEqual({
      checkout: {
        paymentId: "pay_purchase:1",
        purchaseId: 1,
        redirectUrl: "https://checkout.example.test/session",
      },
      ok: true,
    });
    expect(rows).toEqual([{ id: 1, itemId: "sticker-pack", userId: 7 }]);
    expect(payments.listByReference).toHaveBeenCalledWith("purchase:1");
    expect(payments.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500,
        currency: "usd",
        providerId: "stripe-main",
        reference: "purchase:1",
        userId: 7,
      }),
    );
  });

  it("reuses the member's purchase when the checkout is retried", async () => {
    const { db, rows } = createPurchasesDb();
    const payments = createFakePayments();
    const service = createPurchasesService({ db, payments });

    const first = await service.checkout(input);
    const second = await service.checkout(input);

    expect(rows).toHaveLength(1);
    expect(first.ok && first.checkout.purchaseId).toBe(1);
    expect(second.ok && second.checkout.purchaseId).toBe(1);
    expect(
      payments.createCheckout.mock.calls.map(([call]) => call.reference),
    ).toEqual(["purchase:1", "purchase:1"]);
  });

  it("refuses an owned item without starting another checkout", async () => {
    const { db } = createPurchasesDb();
    const payments = createFakePayments([
      { status: "failed" },
      { status: "succeeded" },
    ]);

    const result = await createPurchasesService({ db, payments }).checkout(
      input,
    );

    expect(result).toEqual({ error: "already_owned", ok: false });
    expect(payments.createCheckout).not.toHaveBeenCalled();
  });

  it.each<PaymentErrorCode>([
    "already_paid",
    "payment_in_progress",
    "provider_not_found",
    "provider_rejected",
    "provider_unavailable",
  ])("returns the %s refusal from core as a result", async code => {
    const { db } = createPurchasesDb();
    const payments = createFakePayments();
    payments.createCheckout.mockRejectedValueOnce(new PaymentError(code));

    await expect(
      createPurchasesService({ db, payments }).checkout(input),
    ).resolves.toEqual({ error: code, ok: false });
  });

  it("rethrows an error that is not a payment refusal", async () => {
    const { db } = createPurchasesDb();
    const payments = createFakePayments();
    const failure = new Error("database went away");
    payments.createCheckout.mockRejectedValueOnce(failure);

    await expect(
      createPurchasesService({ db, payments }).checkout(input),
    ).rejects.toBe(failure);
  });
});
