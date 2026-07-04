import { describe, expect, it } from "vitest";

import { resolveQueueTaskOutcome } from "./resolve-queue-task-outcome";

describe("resolveQueueTaskOutcome", () => {
  const now = new Date("2024-01-01T00:00:00Z");

  it("completes when there is no error", () => {
    const outcome = resolveQueueTaskOutcome({
      attempts: 1,
      maxAttempts: 3,
      now,
    });

    expect(outcome.status).toBe("completed");
    expect(outcome.completedAt).toEqual(now);
    expect(outcome.lastError).toBeNull();
    expect(outcome.availableAt).toBeUndefined();
  });

  it("retries with a backoff when the error is recoverable", () => {
    const outcome = resolveQueueTaskOutcome({
      attempts: 1,
      maxAttempts: 3,
      error: "boom",
      now,
    });

    expect(outcome.status).toBe("pending");
    expect(outcome.lastError).toBe("boom");
    expect(outcome.availableAt?.getTime()).toBeGreaterThan(now.getTime());
    expect(outcome.completedAt).toBeUndefined();
  });

  it("fails once attempts reach maxAttempts", () => {
    const outcome = resolveQueueTaskOutcome({
      attempts: 3,
      maxAttempts: 3,
      error: "boom",
      now,
    });

    expect(outcome.status).toBe("failed");
    expect(outcome.lastError).toBe("boom");
    expect(outcome.completedAt).toEqual(now);
    expect(outcome.availableAt).toBeUndefined();
  });

  it("fails when attempts exceed maxAttempts", () => {
    const outcome = resolveQueueTaskOutcome({
      attempts: 5,
      maxAttempts: 3,
      error: "boom",
      now,
    });

    expect(outcome.status).toBe("failed");
  });

  it("backs off further on later retries", () => {
    const first = resolveQueueTaskOutcome({
      attempts: 1,
      maxAttempts: 5,
      error: "boom",
      now,
    });
    const second = resolveQueueTaskOutcome({
      attempts: 2,
      maxAttempts: 5,
      error: "boom",
      now,
    });

    expect(second.availableAt?.getTime()).toBeGreaterThan(
      first.availableAt?.getTime() ?? 0,
    );
  });
});
