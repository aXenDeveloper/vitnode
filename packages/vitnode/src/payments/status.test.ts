// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isPurchaseSettled,
  nextPurchasePaymentStatus,
  purchaseDisplayState,
  subscriptionDisplayState,
} from "./status";

describe("nextPurchasePaymentStatus", () => {
  it("never moves a paid purchase backwards", () => {
    expect(nextPurchasePaymentStatus("paid", "awaiting_payment")).toBe("paid");
    expect(nextPurchasePaymentStatus("paid", "processing")).toBe("paid");
    expect(nextPurchasePaymentStatus("paid", "expired")).toBe("paid");
  });

  it("ignores a stale snapshot older than what is already known", () => {
    expect(nextPurchasePaymentStatus("processing", "awaiting_payment")).toBe(
      "processing",
    );
  });

  it("settles an asynchronous payment", () => {
    expect(nextPurchasePaymentStatus("processing", "paid")).toBe("paid");
    expect(nextPurchasePaymentStatus("processing", "failed")).toBe("failed");
  });

  it("keeps a terminal failure unless money actually arrived", () => {
    expect(nextPurchasePaymentStatus("expired", "awaiting_payment")).toBe(
      "expired",
    );
    expect(nextPurchasePaymentStatus("failed", "processing")).toBe("failed");
    expect(nextPurchasePaymentStatus("expired", "paid")).toBe("paid");
  });
});

describe("purchaseDisplayState", () => {
  const paid = {
    fulfillmentStatus: "fulfilled" as const,
    paymentStatus: "paid" as const,
    refundStatus: "none" as const,
  };

  it("shows a paid purchase whose fulfillment failed as paid, not failed", () => {
    expect(
      purchaseDisplayState({ ...paid, fulfillmentStatus: "failed" }),
    ).toBe("fulfillment_failed");
  });

  it("distinguishes pending fulfillment", () => {
    expect(
      purchaseDisplayState({ ...paid, fulfillmentStatus: "pending" }),
    ).toBe("fulfillment_pending");
  });

  it("reports refunds over fulfillment", () => {
    expect(purchaseDisplayState({ ...paid, refundStatus: "partial" })).toBe(
      "partially_refunded",
    );
    expect(purchaseDisplayState({ ...paid, refundStatus: "full" })).toBe(
      "refunded",
    );
  });

  it("groups expired and canceled attempts as failed", () => {
    expect(
      purchaseDisplayState({
        ...paid,
        fulfillmentStatus: "not_started",
        paymentStatus: "expired",
      }),
    ).toBe("failed");
  });
});

describe("subscriptionDisplayState", () => {
  it.each([
    [{ cancelAtPeriodEnd: false, status: "active" }, "active"],
    [{ cancelAtPeriodEnd: true, status: "active" }, "cancellation_scheduled"],
    [{ cancelAtPeriodEnd: false, status: "past_due" }, "needs_attention"],
    [{ cancelAtPeriodEnd: false, status: "unpaid" }, "needs_attention"],
    [{ cancelAtPeriodEnd: true, status: "canceled" }, "ended"],
    [{ cancelAtPeriodEnd: false, status: "incomplete" }, "incomplete"],
  ] as const)("%o is %s", (subscription, expected) => {
    expect(subscriptionDisplayState(subscription)).toBe(expected);
  });
});

describe("isPurchaseSettled", () => {
  it("keeps polling while paid but not yet fulfilled", () => {
    expect(
      isPurchaseSettled({ fulfillmentStatus: "pending", paymentStatus: "paid" }),
    ).toBe(false);
    expect(
      isPurchaseSettled({ fulfillmentStatus: "fulfilled", paymentStatus: "paid" }),
    ).toBe(true);
    expect(
      isPurchaseSettled({
        fulfillmentStatus: "not_started",
        paymentStatus: "expired",
      }),
    ).toBe(true);
  });
});
