import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Purchase } from "./payments-query";

import {
  PURCHASE_RETURN_MAX_CHECKS,
  purchaseReturnDelay,
  usePurchaseReturn,
} from "./use-purchase-return";

const PURCHASE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const purchase = (overrides: Partial<Purchase>): Purchase => ({
  amount: 1900,
  createdAt: "2026-10-04T10:00:00.000Z",
  currency: "PLN",
  displayState: "awaiting_payment",
  disputeStatus: null,
  fulfillmentStatus: "not_started",
  id: PURCHASE_ID,
  interval: null,
  mode: "one_time",
  offerId: "lifetime-pass",
  offerName: "Lifetime pass",
  paidAt: null,
  paymentStatus: "awaiting_payment",
  pluginId: "@vitnode/example",
  provider: "stripe",
  refundedAmount: 0,
  refundStatus: "none",
  ...overrides,
});

/** Answers each check with the next state in `sequence`, then the last one. */
const purchases = (sequence: Purchase[]) => {
  const calls: { id: string; refresh?: boolean }[] = [];
  const fetchMock = vi.fn(
    async (id: string, options: { refresh?: boolean } = {}) => {
      calls.push({ id, refresh: options.refresh });

      return await Promise.resolve({
        checkoutUrl: null,
        purchase: sequence[Math.min(calls.length - 1, sequence.length - 1)],
      });
    },
  );

  return { calls, fetchMock };
};

const render = (
  fetchState: ReturnType<typeof purchases>["fetchMock"],
  onSettled = vi.fn(),
) => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    onSettled,
    ...renderHook(
      () =>
        usePurchaseReturn({
          fetchState,
          onSettled,
          purchaseId: PURCHASE_ID,
          userId: 7,
        }),
      { wrapper },
    ),
  };
};

/** Lets every timer up to `ms` fire, one poll at a time. */
const elapse = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("purchaseReturnDelay", () => {
  it("backs off and then stays gentle", () => {
    expect([1, 2, 3, 4, 5, 6].map(purchaseReturnDelay)).toEqual([
      1000, 2000, 4000, 8000, 15000, 15000,
    ]);
  });
});

describe("usePurchaseReturn", () => {
  beforeEach(() => {
    // Only the clocks: React Query schedules its own work on microtasks.
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the server to check with the provider, never trusts the redirect", async () => {
    const { calls, fetchMock } = purchases([purchase({})]);
    render(fetchMock);
    await elapse(10);

    expect(calls[0]).toEqual({ id: PURCHASE_ID, refresh: true });
  });

  it("stops polling once the purchase is settled", async () => {
    const { fetchMock } = purchases([
      purchase({}),
      purchase({ displayState: "processing", paymentStatus: "processing" }),
      purchase({
        displayState: "fulfilled",
        fulfillmentStatus: "fulfilled",
        paymentStatus: "paid",
      }),
    ]);
    const { onSettled, result } = render(fetchMock);

    await elapse(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.settled).toBe(true);
    expect(result.current.slow).toBe(false);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("gives up after a bounded number of checks instead of spinning forever", async () => {
    const { fetchMock } = purchases([
      purchase({ displayState: "processing", paymentStatus: "processing" }),
    ]);
    const { result } = render(fetchMock);

    await elapse(10 * 60_000);

    expect(fetchMock).toHaveBeenCalledTimes(PURCHASE_RETURN_MAX_CHECKS);
    expect(result.current.settled).toBe(false);
    expect(result.current.slow).toBe(true);

    // A manual check still works afterwards.
    await act(async () => {
      await result.current.check();
    });
    expect(fetchMock).toHaveBeenCalledTimes(PURCHASE_RETURN_MAX_CHECKS + 1);
  });

  it("stops when the page goes away", async () => {
    const { fetchMock } = purchases([purchase({})]);
    const { unmount } = render(fetchMock);
    await elapse(10);
    const before = fetchMock.mock.calls.length;

    unmount();
    await elapse(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(before);
  });
});
