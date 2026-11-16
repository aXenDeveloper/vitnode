import { beforeEach, describe, expect, it, vi } from "vitest";

import { shouldCronJobRun } from "./should-cron-job-run";

describe("shouldCronJobRun", () => {
  beforeEach(() => {
    // Reset any mocked console methods
    vi.clearAllMocks();
  });

  describe("valid cron schedules", () => {
    it("should return true when job has never run (lastRun is null)", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = null;

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);
    });

    it("should return true when enough time has passed since last run", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = new Date("2024-01-01T10:00:00Z");

      // Mock current time to be 2 hours later
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should return false when not enough time has passed since last run", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = new Date("2024-01-01T11:30:00Z");

      // Mock current time to be 15 minutes later (not enough for hourly job)
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T11:45:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(false);

      vi.useRealTimers();
    });

    it("should handle every 5 minutes job correctly", () => {
      const schedule = "*/5 * * * *"; // Every 5 minutes
      const lastRun = new Date("2024-01-01T10:00:00Z");

      // Mock current time to be 3 minutes later (not enough)
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T10:03:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(false);

      // Mock current time to be 5 minutes later (enough)
      vi.setSystemTime(new Date("2024-01-01T10:05:00Z"));

      const result2 = shouldCronJobRun(schedule, lastRun);

      expect(result2).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("invalid cron schedules", () => {
    it("should return false and log error for invalid cron schedule", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const schedule = "invalid cron"; // Invalid schedule
      const lastRun = null;

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[VitNode]") &&
          expect.stringContaining("Error parsing schedule") &&
          expect.stringContaining("invalid cron"),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return false for malformed cron expression", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const schedule = "60 * * * *"; // Invalid minute (should be 0-59)
      const lastRun = null;

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should return true for empty cron schedule (parsed as valid)", () => {
      // Note: cron-parser actually parses empty string as a valid cron expression
      const schedule = ""; // Empty schedule
      const lastRun = null;

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle lastRun being exactly at the next scheduled time", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = new Date("2024-01-01T10:00:00Z");

      // Mock current time to be exactly at the next scheduled time
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T11:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle lastRun being in the future (clock skew)", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = new Date("2024-01-01T12:00:00Z"); // Future time

      // Mock current time to be earlier
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T11:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });
});
