import { describe, expect, it } from "vitest";

import { validateCronSchedule } from "./validate-cron-schedule";

describe("validateCronSchedule", () => {
  describe("valid 5-field cron expressions", () => {
    it("should validate wildcard expression", () => {
      expect(validateCronSchedule("* * * * *")).toBe(true);
    });

    it("should validate specific time expressions", () => {
      expect(validateCronSchedule("0 0 * * *")).toBe(true); // Daily at midnight
      expect(validateCronSchedule("30 14 * * 1")).toBe(true); // Every Monday at 14:30
      expect(validateCronSchedule("0 0 1 * *")).toBe(true); // First day of month at midnight
      expect(validateCronSchedule("0 0 1 1 *")).toBe(true); // January 1st at midnight
      expect(validateCronSchedule("15 10 * * 5")).toBe(true); // Every Friday at 10:15
    });

    it("should validate step expressions", () => {
      expect(validateCronSchedule("*/5 * * * *")).toBe(true); // Every 5 minutes
      expect(validateCronSchedule("*/15 * * * *")).toBe(true); // Every 15 minutes
      expect(validateCronSchedule("0 */2 * * *")).toBe(true); // Every 2 hours
      expect(validateCronSchedule("0 0 */3 * *")).toBe(true); // Every 3 days
      expect(validateCronSchedule("0-30/5 * * * *")).toBe(true); // Every 5 minutes from 0 to 30
    });

    it("should validate range expressions", () => {
      expect(validateCronSchedule("0 9-17 * * *")).toBe(true); // Every hour from 9am to 5pm
      expect(validateCronSchedule("0 0 1-15 * *")).toBe(true); // First 15 days of month
      expect(validateCronSchedule("0 0 * 1-6 *")).toBe(true); // First 6 months
      expect(validateCronSchedule("0 0 * * 1-5")).toBe(true); // Monday to Friday
    });

    it("should validate list expressions", () => {
      expect(validateCronSchedule("0 0,12 * * *")).toBe(true); // At midnight and noon
      expect(validateCronSchedule("0 0 1,15 * *")).toBe(true); // 1st and 15th of month
      expect(validateCronSchedule("0 0 * * 1,3,5")).toBe(true); // Monday, Wednesday, Friday
      expect(validateCronSchedule("0 9,12,15 * * *")).toBe(true); // At 9am, noon, 3pm
    });

    it("should validate complex expressions", () => {
      expect(validateCronSchedule("0-30/5 9-17 * * 1-5")).toBe(true); // Every 5 minutes from 0-30, 9am-5pm, Monday-Friday
      expect(validateCronSchedule("0 0,12 1,15 * *")).toBe(true); // Midnight and noon on 1st and 15th
      expect(validateCronSchedule("*/10 */2 * * *")).toBe(true); // Every 10 minutes, every 2 hours
    });

    it("should validate weekday 0 and 7 (both Sunday)", () => {
      expect(validateCronSchedule("0 0 * * 0")).toBe(true); // Sunday
      expect(validateCronSchedule("0 0 * * 7")).toBe(true); // Sunday (alternative)
    });

    it("should validate edge cases", () => {
      expect(validateCronSchedule("59 23 31 12 7")).toBe(true); // Max values
      expect(validateCronSchedule("0 0 1 1 0")).toBe(true); // Min values (except minute/hour)
    });
  });

  describe("valid 6-field cron expressions (with seconds)", () => {
    it("should validate wildcard expression with seconds", () => {
      expect(validateCronSchedule("* * * * * *")).toBe(true);
    });

    it("should validate specific time expressions with seconds", () => {
      expect(validateCronSchedule("0 0 0 * * *")).toBe(true); // Daily at midnight
      expect(validateCronSchedule("30 30 14 * * 1")).toBe(true); // Every Monday at 14:30:30
      expect(validateCronSchedule("0 0 0 1 * *")).toBe(true); // First day of month at midnight
    });

    it("should validate step expressions with seconds", () => {
      expect(validateCronSchedule("*/5 * * * * *")).toBe(true); // Every 5 seconds
      expect(validateCronSchedule("0 */5 * * * *")).toBe(true); // Every 5 minutes
      expect(validateCronSchedule("*/30 0 * * * *")).toBe(true); // Every 30 seconds at minute 0
    });

    it("should validate range expressions with seconds", () => {
      expect(validateCronSchedule("0-30 0 9-17 * * *")).toBe(true); // Seconds 0-30, minute 0, 9am-5pm
    });

    it("should validate list expressions with seconds", () => {
      expect(validateCronSchedule("0,30 0 0,12 * * *")).toBe(true); // At 0 and 30 seconds, midnight and noon
    });
  });

  describe("invalid cron expressions", () => {
    it("should reject empty or non-string input", () => {
      expect(validateCronSchedule("")).toBe(false);
      expect(validateCronSchedule("   ")).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(validateCronSchedule(null)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(validateCronSchedule(undefined)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(validateCronSchedule(123)).toBe(false);
    });

    it("should reject wrong number of fields", () => {
      expect(validateCronSchedule("* * *")).toBe(false); // Too few
      expect(validateCronSchedule("* * * *")).toBe(false); // Too few
      expect(validateCronSchedule("* * * * * * *")).toBe(false); // Too many
      expect(validateCronSchedule("* * * * * * * *")).toBe(false); // Too many
    });

    it("should reject invalid characters", () => {
      expect(validateCronSchedule("a * * * *")).toBe(false);
      expect(validateCronSchedule("* b * * *")).toBe(false);
      expect(validateCronSchedule("* * c * *")).toBe(false);
      expect(validateCronSchedule("@ # $ % ^")).toBe(false);
      expect(validateCronSchedule("invalid cron")).toBe(false);
    });

    it("should reject out-of-range values", () => {
      expect(validateCronSchedule("60 * * * *")).toBe(false); // Minute > 59
      expect(validateCronSchedule("* 24 * * *")).toBe(false); // Hour > 23
      expect(validateCronSchedule("* * 32 * *")).toBe(false); // Day > 31
      expect(validateCronSchedule("* * 0 * *")).toBe(false); // Day < 1
      expect(validateCronSchedule("* * * 13 *")).toBe(false); // Month > 12
      expect(validateCronSchedule("* * * 0 *")).toBe(false); // Month < 1
      expect(validateCronSchedule("* * * * 8")).toBe(false); // Weekday > 7
      expect(validateCronSchedule("-1 * * * *")).toBe(false); // Negative minute
    });

    it("should reject out-of-range values in 6-field format", () => {
      expect(validateCronSchedule("60 * * * * *")).toBe(false); // Second > 59
      expect(validateCronSchedule("-1 * * * * *")).toBe(false); // Negative second
    });

    it("should reject invalid ranges", () => {
      expect(validateCronSchedule("10-5 * * * *")).toBe(false); // Start > end
      expect(validateCronSchedule("* 20-10 * * *")).toBe(false); // Start > end
      expect(validateCronSchedule("* * 60-70 * *")).toBe(false); // Out of range
      expect(validateCronSchedule("0-60 * * * *")).toBe(false); // End out of range
    });

    it("should reject invalid steps", () => {
      expect(validateCronSchedule("*/0 * * * *")).toBe(false); // Step of 0
      expect(validateCronSchedule("*/-1 * * * *")).toBe(false); // Negative step
      expect(validateCronSchedule("*/60 * * * *")).toBe(false); // Step > max
      expect(validateCronSchedule("*/abc * * * *")).toBe(false); // Non-numeric step
      expect(validateCronSchedule("* */25 * * *")).toBe(false); // Step > max for hour
    });

    it("should reject invalid lists", () => {
      expect(validateCronSchedule("0,60 * * * *")).toBe(false); // Out of range in list
      expect(validateCronSchedule("* 0,24 * * *")).toBe(false); // Out of range in list
      expect(validateCronSchedule("a,b,c * * * *")).toBe(false); // Non-numeric list
      expect(validateCronSchedule(",, * * * *")).toBe(false); // Empty list items
    });

    it("should reject malformed expressions", () => {
      expect(validateCronSchedule("1--5 * * * *")).toBe(false); // Double dash
      expect(validateCronSchedule("1//5 * * * *")).toBe(false); // Double slash
      expect(validateCronSchedule("1- * * * *")).toBe(false); // Incomplete range
      expect(validateCronSchedule("-5 * * * *")).toBe(false); // Invalid start
      expect(validateCronSchedule("1/ * * * *")).toBe(false); // Incomplete step
      expect(validateCronSchedule("/5 * * * *")).toBe(false); // Missing base for step
    });
  });

  describe("edge cases", () => {
    it("should handle extra whitespace", () => {
      expect(validateCronSchedule("  * * * * *  ")).toBe(true);
      expect(validateCronSchedule("0  0  *  *  *")).toBe(true);
    });

    it("should reject mixed valid and invalid fields", () => {
      expect(validateCronSchedule("0 0 * * invalid")).toBe(false);
      expect(validateCronSchedule("0 25 * * *")).toBe(false); // Invalid hour
      expect(validateCronSchedule("* * * * * 60")).toBe(false); // Invalid second in 6-field
    });
  });
});
