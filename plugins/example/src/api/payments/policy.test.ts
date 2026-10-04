import { describe, expect, it } from "vitest";

import {
  hasActiveAccess,
  shouldRevokeAfterRefund,
  subscriptionAccessUntil,
} from "./policy";

const now = new Date("2026-10-04T12:00:00Z");

describe("hasActiveAccess", () => {
  it("keeps a one-time grant with no end date", () => {
    expect(hasActiveAccess({ accessUntil: null, revokedAt: null }, now)).toBe(
      true,
    );
  });

  it("enforces expiry at read time, without waiting for a job", () => {
    expect(
      hasActiveAccess(
        { accessUntil: new Date("2026-10-04T11:59:59Z"), revokedAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      hasActiveAccess(
        { accessUntil: new Date("2026-10-04T12:00:01Z"), revokedAt: null },
        now,
      ),
    ).toBe(true);
  });

  it("refuses a revoked grant and a missing one", () => {
    expect(hasActiveAccess({ accessUntil: null, revokedAt: now }, now)).toBe(
      false,
    );
    expect(hasActiveAccess(undefined, now)).toBe(false);
  });
});

describe("shouldRevokeAfterRefund", () => {
  it("revokes only on a full refund", () => {
    expect(shouldRevokeAfterRefund({ refundStatus: "full" })).toBe(true);
    expect(shouldRevokeAfterRefund({ refundStatus: "partial" })).toBe(false);
    expect(shouldRevokeAfterRefund({ refundStatus: "none" })).toBe(false);
  });
});

describe("subscriptionAccessUntil", () => {
  const paidThrough = new Date("2026-11-04T12:00:00Z");

  it("grants nothing before the first verified payment", () => {
    expect(
      subscriptionAccessUntil({ endedAt: null, paidThrough: null }),
    ).toBeNull();
  });

  it("lasts until the end of the paid period, including after a scheduled cancellation", () => {
    expect(subscriptionAccessUntil({ endedAt: null, paidThrough })).toEqual(
      paidThrough,
    );
  });

  it("ends early when the subscription ended early", () => {
    const endedAt = new Date("2026-10-10T00:00:00Z");

    expect(subscriptionAccessUntil({ endedAt, paidThrough })).toEqual(endedAt);
  });
});
