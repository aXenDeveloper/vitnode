import { describe, expect, it } from "vitest";

import { getQueueBackoffDate } from "./get-queue-backoff-date";

describe("getQueueBackoffDate", () => {
  const from = new Date("2024-01-01T00:00:00Z");
  const secondsFrom = (date: Date) => (date.getTime() - from.getTime()) / 1000;

  it("delays by the base amount after the first attempt", () => {
    expect(secondsFrom(getQueueBackoffDate(1, from))).toBe(10);
  });

  it("grows exponentially with attempts", () => {
    expect(secondsFrom(getQueueBackoffDate(2, from))).toBe(20);
    expect(secondsFrom(getQueueBackoffDate(3, from))).toBe(40);
    expect(secondsFrom(getQueueBackoffDate(4, from))).toBe(80);
  });

  it("is monotonically increasing", () => {
    const delays = [1, 2, 3, 4, 5].map(a =>
      secondsFrom(getQueueBackoffDate(a, from)),
    );
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it("caps the delay at one hour", () => {
    expect(secondsFrom(getQueueBackoffDate(50, from))).toBe(3600);
  });

  it("treats attempts <= 1 as the base delay (no negative exponent)", () => {
    expect(secondsFrom(getQueueBackoffDate(0, from))).toBe(10);
  });

  it("returns a date after the provided origin", () => {
    expect(getQueueBackoffDate(1, from).getTime()).toBeGreaterThan(
      from.getTime(),
    );
  });
});
