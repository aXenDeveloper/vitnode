import { describe, expect, it } from "vitest";

import { getQueueStatus } from "./get-queue-status";

describe("getQueueStatus", () => {
  it("is active when handlers are registered and cron is running", () => {
    expect(
      getQueueStatus({
        cronActive: true,
        cronStale: false,
        hasTaskHandlers: true,
      }),
    ).toEqual({ active: true, cronStale: false });
  });

  it("is inactive when cron is off, even if not stale", () => {
    expect(
      getQueueStatus({
        cronActive: false,
        cronStale: false,
        hasTaskHandlers: true,
      }),
    ).toEqual({ active: false, cronStale: false });
  });

  it("does not flag cron-stale when cron is off", () => {
    expect(
      getQueueStatus({
        cronActive: false,
        cronStale: true,
        hasTaskHandlers: true,
      }),
    ).toEqual({ active: false, cronStale: false });
  });

  it("is inactive and flags cron-stale when cron is configured but stale", () => {
    expect(
      getQueueStatus({
        cronActive: true,
        cronStale: true,
        hasTaskHandlers: true,
      }),
    ).toEqual({ active: false, cronStale: true });
  });

  it("is inactive when no task handlers are registered", () => {
    expect(
      getQueueStatus({
        cronActive: true,
        cronStale: false,
        hasTaskHandlers: false,
      }),
    ).toEqual({ active: false, cronStale: false });
  });
});
