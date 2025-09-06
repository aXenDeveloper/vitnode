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

    it("should handle daily job correctly", () => {
      const schedule = "0 9 * * *"; // Every day at 9 AM
      const lastRun = new Date("2024-01-01T09:00:00Z");

      // Mock current time to be next day at 10 AM
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-02T10:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle weekly job correctly", () => {
      const schedule = "0 9 * * 1"; // Every Monday at 9 AM
      const lastRun = new Date("2024-01-01T09:00:00Z"); // Monday

      // Mock current time to be next Monday
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-08T10:00:00Z")); // Next Monday

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle monthly job correctly", () => {
      const schedule = "0 9 1 * *"; // First day of every month at 9 AM
      const lastRun = new Date("2024-01-01T09:00:00Z");

      // Mock current time to be next month
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle every minute job correctly", () => {
      const schedule = "* * * * *"; // Every minute
      const lastRun = new Date("2024-01-01T10:00:00Z");

      // Mock current time to be 1 minute later
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T10:01:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

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

    it("should handle complex cron expressions", () => {
      const schedule = "0 9-17 * * 1-5"; // 9 AM to 5 PM on weekdays
      const lastRun = new Date("2024-01-01T09:00:00Z"); // Monday 9 AM

      // Mock current time to be same day at 10 AM
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

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

    it("should handle lastRun being epoch (new Date(0))", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = new Date(0); // Epoch time

      // Mock current time to be much later
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle yearly cron job", () => {
      const schedule = "0 0 1 1 *"; // January 1st at midnight
      const lastRun = new Date("2023-01-01T00:00:00Z");

      // Mock current time to be next year
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T01:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle specific day of month with month", () => {
      const schedule = "0 12 15 6 *"; // June 15th at noon
      const lastRun = new Date("2023-06-15T12:00:00Z");

      // Mock current time to be next year same date
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T13:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("timezone handling", () => {
    it("should work with different timezone dates", () => {
      const schedule = "0 9 * * *"; // Every day at 9 AM
      const lastRun = new Date("2024-01-01T09:00:00+05:00"); // 9 AM in +5 timezone

      // Mock current time to be next day in UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-02T04:00:00Z")); // 9 AM in +5 timezone

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("performance and boundary conditions", () => {
    it("should handle very old lastRun dates", () => {
      const schedule = "0 * * * *"; // Every hour
      const lastRun = new Date("1970-01-01T00:00:00Z"); // Very old date

      // Current time
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it("should handle leap year considerations", () => {
      const schedule = "0 0 29 2 *"; // February 29th (leap day)
      const lastRun = new Date("2020-02-29T00:00:00Z"); // Last leap year

      // Mock current time to be next leap year
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-02-29T01:00:00Z"));

      const result = shouldCronJobRun(schedule, lastRun);

      expect(result).toBe(true);

      vi.useRealTimers();
    });
  });
});
