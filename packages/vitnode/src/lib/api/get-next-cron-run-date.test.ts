import { describe, expect, it, vi } from "vitest";

import { getNextCronRunDate } from "./get-next-cron-run-date";

describe("getNextCronRunDate", () => {
  it("should return the next run date for a valid cron schedule with lastRun null", () => {
    const schedule = "0 0 * * *"; // Daily at midnight
    const lastRun = null;
    const result = getNextCronRunDate(schedule, lastRun);

    expect(result).toBeInstanceOf(Date);
    if (result) {
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    }
  });

  it("should return the next run date for a valid cron schedule with lastRun provided", () => {
    const schedule = "0 0 * * *"; // Daily at midnight
    const lastRun = new Date("2023-01-01T12:00:00Z");
    const result = getNextCronRunDate(schedule, lastRun);

    expect(result).toBeInstanceOf(Date);
    if (result) {
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getTime()).toBeGreaterThan(lastRun.getTime());
    }
  });

  it("should return null for an invalid cron schedule", () => {
    const schedule = "invalid cron";
    const lastRun = null;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = getNextCronRunDate(schedule, lastRun);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[VitNode]"),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should handle cron schedules with specific times", () => {
    const schedule = "30 14 * * 1"; // Every Monday at 14:30
    const lastRun = new Date("2023-01-01T10:00:00Z"); // Sunday
    const result = getNextCronRunDate(schedule, lastRun);

    expect(result).toBeInstanceOf(Date);
    if (result) {
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    }
  });

  it("should return null when cron parsing throws an error", () => {
    // This test assumes cron-parser can throw for certain invalid inputs
    const schedule = "99 99 99 99 99"; // Invalid cron with out-of-range values
    const lastRun = null;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = getNextCronRunDate(schedule, lastRun);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
