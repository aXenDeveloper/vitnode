import { describe, expect, it } from "vitest";

import { buildNotificationStatsBuckets, foldNotificationStats } from "./stats";

describe("buildNotificationStatsBuckets", () => {
  it("returns the last 7 local days and the 7 before them", () => {
    const buckets = buildNotificationStatsBuckets({
      now: new Date("2026-10-04T10:00:00Z"),
      range: "7d",
      timeZone: "UTC",
    });

    expect(buckets.current).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(buckets.previous[0]).toBe("2026-09-21");
    expect(buckets.previous.at(-1)).toBe("2026-09-27");
  });

  it("counts days in the viewer's time zone, not UTC", () => {
    const { current } = buildNotificationStatsBuckets({
      now: new Date("2026-10-04T23:30:00Z"),
      range: "7d",
      timeZone: "Europe/Warsaw",
    });

    expect(current.at(-1)).toBe("2026-10-05");
  });

  it("returns 24 hourly buckets ending with the current hour", () => {
    const { current, previous } = buildNotificationStatsBuckets({
      now: new Date("2026-10-04T10:15:00Z"),
      range: "24h",
      timeZone: "UTC",
    });

    expect(current).toHaveLength(24);
    expect(previous).toHaveLength(24);
    expect(current[0]).toBe("2026-10-03T11");
    expect(current.at(-1)).toBe("2026-10-04T10");
  });
});

describe("foldNotificationStats", () => {
  it("fills empty buckets with zeros and totals both periods", () => {
    const result = foldNotificationStats(
      [
        { count: 5, key: "2026-10-02", metric: "sent" },
        { count: 2, key: "2026-10-02", metric: "failed" },
        { count: 3, key: "2026-10-03", metric: "events" },
        { count: 9, key: "2026-09-30", metric: "sent" },
      ],
      {
        current: ["2026-10-02", "2026-10-03"],
        previous: ["2026-09-30", "2026-10-01"],
      },
    );

    expect(result.points).toEqual([
      { events: 0, failed: 2, key: "2026-10-02", sent: 5, skipped: 0 },
      { events: 3, failed: 0, key: "2026-10-03", sent: 0, skipped: 0 },
    ]);
    expect(result.totals).toEqual({
      events: 3,
      failed: 2,
      sent: 5,
      skipped: 0,
    });
    expect(result.previous).toEqual({
      events: 0,
      failed: 0,
      sent: 9,
      skipped: 0,
    });
  });
});
