import { describe, expect, it } from "vitest";

import {
  getFirstDayOfWeek,
  parseDateString,
  toDateString,
} from "./calendar-utils";

describe("toDateString", () => {
  it("writes the local calendar day, not the UTC one", () => {
    expect(toDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("parseDateString", () => {
  it("reads a date-only string as local midnight", () => {
    const date = parseDateString("2026-10-07");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(7);
    expect(date?.getHours()).toBe(0);
  });

  it("rejects days that do not exist", () => {
    expect(parseDateString("2026-02-30")).toBeUndefined();
  });

  it("rejects anything that is not a date-only string", () => {
    expect(parseDateString("2026-10-07T10:00:00.000Z")).toBeUndefined();
    expect(parseDateString("")).toBeUndefined();
    expect(parseDateString(null)).toBeUndefined();
    expect(parseDateString(new Date())).toBeUndefined();
  });
});

describe("getFirstDayOfWeek", () => {
  it("starts the week on Monday in Poland and Sunday in the US", () => {
    expect(getFirstDayOfWeek("pl")).toBe(1);
    expect(getFirstDayOfWeek("en-US")).toBe(0);
  });
});
