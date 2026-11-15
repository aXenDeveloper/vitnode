import { describe, expect, it } from "vitest";

import { formatDecimal, parseDecimal } from "./decimal";
import {
  dailyAiRate,
  fillAiUsageDays,
  forecastAiSpend,
  sumAiUsage,
} from "./overview-math";

const row = (day: string, knownCostUsd: string, operations = 1) => ({
  chargedUsd: knownCostUsd,
  day,
  failures: "0",
  inputTokens: 10,
  knownCostUsd,
  knownOperations: operations,
  operations,
  outputTokens: "5",
});

describe("fillAiUsageDays", () => {
  it("gives every day of the range a row, empty days included, and stops at today", () => {
    const days = fillAiUsageDays(
      { end: "2026-10-31", start: "2026-10-01" },
      "2026-10-03",
      [row("2026-10-02", "0.5")],
    );

    expect(days.map(day => day.day)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(days[0]).toMatchObject({ knownCostUsd: "0", operations: 0 });
    expect(days[1]).toMatchObject({
      inputTokens: 10,
      knownCostUsd: "0.5",
      outputTokens: 5,
    });
  });

  it("returns nothing for a range that starts after today", () => {
    expect(
      fillAiUsageDays(
        { end: "2026-11-30", start: "2026-11-01" },
        "2026-10-06",
        [],
      ),
    ).toEqual([]);
  });
});

describe("sumAiUsage", () => {
  it("adds costs exactly, without float drift", () => {
    const total = sumAiUsage(
      fillAiUsageDays(
        { end: "2026-10-03", start: "2026-10-01" },
        "2026-10-03",
        [
          row("2026-10-01", "0.1"),
          row("2026-10-02", "0.2"),
          row("2026-10-03", "0.000000000001"),
        ],
      ),
    );

    expect(total.knownCostUsd).toBe("0.300000000001");
    expect(total.chargedUsd).toBe("0.300000000001");
    expect(total.operations).toBe(3);
    expect(total.inputTokens).toBe(30);
  });
});

describe("dailyAiRate", () => {
  it("leaves today out because it is not over yet", () => {
    const days = fillAiUsageDays(
      { end: "2026-10-03", start: "2026-10-01" },
      "2026-10-03",
      [
        row("2026-10-01", "4"),
        row("2026-10-02", "6"),
        row("2026-10-03", "100"),
      ],
    );

    expect(formatDecimal(dailyAiRate(days, "2026-10-03"))).toBe("5");
  });

  it("uses today when it is the only day there is", () => {
    const days = fillAiUsageDays(
      { end: "2026-10-01", start: "2026-10-01" },
      "2026-10-01",
      [row("2026-10-01", "3")],
    );

    expect(formatDecimal(dailyAiRate(days, "2026-10-01"))).toBe("3");
  });
});

describe("forecastAiSpend", () => {
  it("adds the daily rate for the days left to what is already spent", () => {
    expect(
      formatDecimal(
        forecastAiSpend({
          rate: parseDecimal("5"),
          remainingDays: 2.5,
          spent: parseDecimal("30"),
        }),
      ),
    ).toBe("42.5");
  });

  it("never forecasts below what is spent", () => {
    expect(
      formatDecimal(
        forecastAiSpend({
          rate: parseDecimal("5"),
          remainingDays: -1,
          spent: parseDecimal("30"),
        }),
      ),
    ).toBe("30");
  });
});
