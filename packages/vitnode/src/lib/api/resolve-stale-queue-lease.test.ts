// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  QUEUE_LEASE_EXPIRED_ERROR,
  QUEUE_LEASE_TIMEOUT_MS,
  queueLeaseCutoff,
  resolveStaleQueueLease,
} from "./resolve-stale-queue-lease";

describe("queueLeaseCutoff", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("looks one lease window back", () => {
    expect(queueLeaseCutoff(now).toISOString()).toBe(
      "2026-01-01T11:45:00.000Z",
    );
  });

  it("leaves a reservation younger than the lease alone", () => {
    const reservedAt = new Date(now.getTime() - QUEUE_LEASE_TIMEOUT_MS + 1_000);

    expect(reservedAt.getTime()).toBeGreaterThan(
      queueLeaseCutoff(now).getTime(),
    );
  });

  it("reclaims a reservation older than the lease", () => {
    const reservedAt = new Date(now.getTime() - QUEUE_LEASE_TIMEOUT_MS - 1_000);

    expect(reservedAt.getTime()).toBeLessThan(queueLeaseCutoff(now).getTime());
  });
});

describe("resolveStaleQueueLease", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("puts a task with attempts left back on the queue immediately", () => {
    expect(
      resolveStaleQueueLease({ attempts: 1, maxAttempts: 3, now }),
    ).toEqual({
      availableAt: now,
      lastError: QUEUE_LEASE_EXPIRED_ERROR,
      status: "pending",
    });
  });

  it("fails a task whose crashed run spent its last attempt", () => {
    // The attempt was counted when the task was claimed, so a handler that
    // reliably kills its worker cannot cycle forever.
    expect(
      resolveStaleQueueLease({ attempts: 3, maxAttempts: 3, now }),
    ).toEqual({
      completedAt: now,
      lastError: QUEUE_LEASE_EXPIRED_ERROR,
      status: "failed",
    });
  });

  it("always says why, so an operator does not read an empty lastError", () => {
    expect(
      resolveStaleQueueLease({ attempts: 1, maxAttempts: 3, now }).lastError,
    ).toContain("lease expired");
  });
});
