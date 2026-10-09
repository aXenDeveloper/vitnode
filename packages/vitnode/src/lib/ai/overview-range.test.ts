import { describe, expect, it } from "vitest";

import {
  aiMonthRange,
  compareAiRange,
  countAiDays,
  isAiDay,
  isAiMonth,
  listAiDays,
  matchAiPreset,
  resolveAiOverviewRange,
  resolveAiPreset,
  shiftAiMonth,
} from "./overview-range";

const TODAY = "2026-10-06";

describe("resolveAiPreset", () => {
  it("counts rolling presets back from today, inclusive", () => {
    expect(resolveAiPreset("7d", TODAY)).toEqual({
      end: TODAY,
      start: "2026-09-30",
    });
    expect(countAiDays(resolveAiPreset("30d", TODAY))).toBe(30);
    expect(countAiDays(resolveAiPreset("90d", TODAY))).toBe(90);
  });

  it("reads this month so far and the whole of last month", () => {
    expect(resolveAiPreset("this-month", TODAY)).toEqual({
      end: TODAY,
      start: "2026-10-01",
    });
    expect(resolveAiPreset("last-month", "2026-03-15")).toEqual({
      end: "2026-02-28",
      start: "2026-02-01",
    });
  });
});

describe("resolveAiOverviewRange", () => {
  it("falls back to this month when the search says nothing usable", () => {
    expect(resolveAiOverviewRange({ preset: "nope", today: TODAY })).toEqual({
      preset: "this-month",
      range: { end: TODAY, start: "2026-10-01" },
    });
  });

  it("orders a custom range, stops it at today and names it when it is a preset", () => {
    expect(
      resolveAiOverviewRange({
        from: "2026-10-30",
        to: "2026-10-01",
        today: TODAY,
      }),
    ).toEqual({
      preset: "this-month",
      range: { end: TODAY, start: "2026-10-01" },
    });
  });

  it("keeps a custom range custom and caps its length", () => {
    expect(
      resolveAiOverviewRange({
        from: "2026-09-12",
        to: "2026-09-25",
        today: TODAY,
      }),
    ).toEqual({
      preset: null,
      range: { end: "2026-09-25", start: "2026-09-12" },
    });
    expect(
      countAiDays(
        resolveAiOverviewRange({
          from: "2020-01-01",
          to: TODAY,
          today: TODAY,
        }).range,
      ),
    ).toBe(366);
  });

  it("ignores dates that are not real calendar days", () => {
    expect(
      resolveAiOverviewRange({
        from: "2026-02-30",
        preset: "7d",
        to: TODAY,
        today: TODAY,
      }).preset,
    ).toBe("7d");
  });
});

describe("compareAiRange", () => {
  it("compares this month so far with the same days of last month", () => {
    expect(compareAiRange({ end: TODAY, start: "2026-10-01" }, TODAY)).toEqual({
      kind: "month-to-date",
      range: { end: "2026-09-06", start: "2026-09-01" },
    });
  });

  it("never runs a month-to-date comparison past the end of a shorter month", () => {
    expect(
      compareAiRange({ end: "2026-03-31", start: "2026-03-01" }, "2026-03-31"),
    ).toEqual({
      kind: "previous-month",
      range: { end: "2026-02-28", start: "2026-02-01" },
    });
    expect(
      compareAiRange({ end: "2026-03-30", start: "2026-03-01" }, "2026-03-30")
        .range.end,
    ).toBe("2026-02-28");
  });

  it("compares a whole month with the whole month before", () => {
    expect(
      compareAiRange({ end: "2026-09-30", start: "2026-09-01" }, TODAY),
    ).toEqual({
      kind: "previous-month",
      range: { end: "2026-08-31", start: "2026-08-01" },
    });
  });

  it("compares any other range with the days just before it", () => {
    expect(
      compareAiRange({ end: "2026-09-25", start: "2026-09-12" }, TODAY),
    ).toEqual({
      kind: "preceding",
      range: { end: "2026-09-11", start: "2026-08-29" },
    });
  });
});

describe("day and month helpers", () => {
  it("validates days and months", () => {
    expect(isAiDay("2026-10-06")).toBe(true);
    expect(isAiDay("2026-13-01")).toBe(false);
    expect(isAiDay(20_261_006)).toBe(false);
    expect(isAiMonth("2026-10")).toBe(true);
    expect(isAiMonth("2026-1")).toBe(false);
  });

  it("walks months across a year boundary", () => {
    expect(shiftAiMonth("2026-01", -1)).toBe("2025-12");
    expect(aiMonthRange("2028-02")).toEqual({
      end: "2028-02-29",
      start: "2028-02-01",
    });
    expect(listAiDays({ end: "2026-01-02", start: "2025-12-31" })).toEqual([
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("matches a range to its preset", () => {
    expect(matchAiPreset({ end: TODAY, start: "2026-09-30" }, TODAY)).toBe(
      "7d",
    );
    expect(matchAiPreset({ end: TODAY, start: "2026-09-29" }, TODAY)).toBe(
      null,
    );
  });
});
