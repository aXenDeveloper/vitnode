import { describe, expect, it } from "vitest";

import { CRON_STALE_THRESHOLD_MS, isCronStale } from "./is-cron-stale";

describe("isCronStale", () => {
  const now = new Date("2024-01-01T12:00:00Z");

  it("returns false when no job has ever run (null activity)", () => {
    expect(isCronStale(null, now)).toBe(false);
  });

  it("returns false when the last activity is within the threshold", () => {
    const lastActivityAt = new Date(
      now.getTime() - CRON_STALE_THRESHOLD_MS + 1,
    );

    expect(isCronStale(lastActivityAt, now)).toBe(false);
  });

  it("returns false when the last activity is exactly at the threshold", () => {
    const lastActivityAt = new Date(now.getTime() - CRON_STALE_THRESHOLD_MS);

    expect(isCronStale(lastActivityAt, now)).toBe(false);
  });

  it("returns true when the last activity is just past the threshold", () => {
    const lastActivityAt = new Date(
      now.getTime() - CRON_STALE_THRESHOLD_MS - 1,
    );

    expect(isCronStale(lastActivityAt, now)).toBe(true);
  });

  it("returns true when the last activity is far past the threshold", () => {
    const lastActivityAt = new Date("2024-01-01T00:00:00Z"); // 12h ago

    expect(isCronStale(lastActivityAt, now)).toBe(true);
  });

  it("returns false when the last activity is in the future (clock skew)", () => {
    const lastActivityAt = new Date(now.getTime() + CRON_STALE_THRESHOLD_MS);

    expect(isCronStale(lastActivityAt, now)).toBe(false);
  });

  it("defaults `now` to the current time", () => {
    const justNow = new Date(Date.now() - 1000);

    expect(isCronStale(justNow)).toBe(false);
  });
});
