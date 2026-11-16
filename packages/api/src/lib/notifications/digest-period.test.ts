import { describe, expect, it } from "vitest";

import { latestEndedDigestPeriod, zonedHourToUtc } from "./digest-period";

const daily = (now: string, timeZone: string, hour = 8) =>
  latestEndedDigestPeriod({
    hour,
    mode: "daily",
    now: new Date(now),
    timeZone,
    weekday: 1,
  });

describe("zonedHourToUtc", () => {
  it("follows the zone's offset on either side of DST", () => {
    expect(
      zonedHourToUtc({ day: 15, month: 1, year: 2026 }, 8, "Europe/Warsaw"),
    ).toEqual(new Date("2026-01-15T07:00:00Z"));
    expect(
      zonedHourToUtc({ day: 15, month: 7, year: 2026 }, 8, "Europe/Warsaw"),
    ).toEqual(new Date("2026-07-15T06:00:00Z"));
  });

  it("moves Warsaw's skipped 02:00 on 29 March 2026 to the end of the gap", () => {
    expect(
      zonedHourToUtc({ day: 29, month: 3, year: 2026 }, 2, "Europe/Warsaw"),
    ).toEqual(new Date("2026-03-29T01:00:00Z"));
  });

  it("picks the first of New York's repeated 01:00 on 1 November 2026", () => {
    expect(
      zonedHourToUtc({ day: 1, month: 11, year: 2026 }, 1, "America/New_York"),
    ).toEqual(new Date("2026-11-01T05:00:00Z"));
  });
});

describe("latestEndedDigestPeriod", () => {
  it("covers the 23-hour day when clocks spring forward", () => {
    const period = daily("2026-03-29T10:00:00Z", "Europe/Warsaw");

    expect(period).toEqual({
      end: new Date("2026-03-29T06:00:00Z"),
      key: "2026-03-29",
      start: new Date("2026-03-28T07:00:00Z"),
    });
  });

  it("covers the 25-hour day when clocks fall back", () => {
    const period = daily("2026-10-25T12:00:00Z", "Europe/Warsaw");

    expect(period.end.getTime() - period.start.getTime()).toBe(
      25 * 60 * 60 * 1000,
    );
    expect(period.key).toBe("2026-10-25");
  });

  it("uses yesterday's period until today's send hour has passed", () => {
    expect(daily("2026-06-10T05:59:00Z", "Europe/Warsaw").key).toBe(
      "2026-06-09",
    );
    expect(daily("2026-06-10T06:00:00Z", "Europe/Warsaw").key).toBe(
      "2026-06-10",
    );
  });

  it("lands on the local date, not the UTC one (23:30 UTC on the 9th is the 10th in Tokyo)", () => {
    expect(daily("2026-06-09T23:30:00Z", "Asia/Tokyo").key).toBe("2026-06-10");
  });

  it("ends weekly periods on the chosen weekday, a week apart", () => {
    const thursdayNoonUtc = new Date("2026-10-08T12:00:00Z");
    const period = latestEndedDigestPeriod({
      hour: 9,
      mode: "weekly",
      now: thursdayNoonUtc,
      timeZone: "UTC",
      weekday: 1,
    });

    expect(period).toEqual({
      end: new Date("2026-10-05T09:00:00Z"),
      key: "2026-10-05",
      start: new Date("2026-09-28T09:00:00Z"),
    });
  });
});
