import { describe, expect, it } from "vitest";

import type { AiUsageDay } from "../ai-query";

import {
  cumulativeCost,
  measureValue,
  metricValue,
  runningSeries,
} from "./overview-metrics";

const day = (
  date: string,
  overrides: Partial<Omit<AiUsageDay, "day">> = {},
): AiUsageDay => ({
  chargedUsd: "0",
  day: date,
  failures: 0,
  inputTokens: 0,
  knownCostUsd: "0",
  knownOperations: 0,
  operations: 0,
  outputTokens: 0,
  ...overrides,
});

describe("metricValue", () => {
  it("never counts an unknown cost as zero in the cost per run", () => {
    expect(
      metricValue("per_run", {
        chargedUsd: "0.1",
        failures: 0,
        inputTokens: 0,
        knownCostUsd: "0.06",
        knownOperations: 3,
        operations: 4,
        outputTokens: 0,
      }),
    ).toBeCloseTo(0.02);
  });

  it("treats a range with no runs as fully priced and failure free", () => {
    const empty = day("2026-10-01");

    expect(metricValue("known", empty)).toBe(1);
    expect(metricValue("failure_rate", empty)).toBe(0);
    expect(metricValue("per_run", empty)).toBe(0);
  });

  it("adds input and output tokens", () => {
    expect(
      measureValue(
        "tokens",
        day("2026-10-01", { inputTokens: 7, outputTokens: 3 }),
      ),
    ).toBe(10);
  });
});

describe("runningSeries", () => {
  it("sums totals day by day and lines up the previous window by position", () => {
    const series = runningSeries(
      "spend",
      [
        day("2026-10-01", { knownCostUsd: "1" }),
        day("2026-10-02", { knownCostUsd: "2" }),
      ],
      [day("2026-09-01", { knownCostUsd: "5" })],
    );

    expect(series).toEqual([
      { day: "2026-10-01", previous: 5, previousDay: "2026-09-01", value: 1 },
      { day: "2026-10-02", previous: null, previousDay: null, value: 3 },
    ]);
  });

  it("averages ratios over everything so far instead of summing them", () => {
    const series = runningSeries(
      "failure_rate",
      [
        day("2026-10-01", { failures: 1, operations: 2 }),
        day("2026-10-02", { failures: 0, operations: 8 }),
      ],
      [],
    );

    expect(series.map(point => point.value)).toEqual([0.5, 0.1]);
  });
});

describe("cumulativeCost", () => {
  it("builds the budget burn-up from daily costs", () => {
    expect(
      cumulativeCost([
        { costUsd: "1.5", day: "2026-10-01" },
        { costUsd: "0", day: "2026-10-02" },
        { costUsd: "2", day: "2026-10-03" },
      ]).map(point => point.value),
    ).toEqual([1.5, 1.5, 3.5]);
  });
});
