import { describe, expect, it } from "vitest";

import { getCronHealth, isCronJobOverdue } from "./cron-health";

const NOW = new Date("2026-10-04T15:35:00Z");

const job = (overrides: {
  createdAt?: string;
  lastRun?: null | string;
  schedule?: string;
}) => ({
  createdAt: new Date(overrides.createdAt ?? "2026-01-01T00:00:00Z"),
  lastRun: overrides.lastRun ? new Date(overrides.lastRun) : null,
  schedule: overrides.schedule ?? "* * * * *",
});

describe("isCronJobOverdue", () => {
  it("is on time when the last run is within the schedule", () => {
    expect(
      isCronJobOverdue(job({ lastRun: "2026-10-04T15:34:00Z" }), NOW),
    ).toBe(false);
  });

  it("tolerates a missed tick inside the grace period", () => {
    expect(
      isCronJobOverdue(job({ lastRun: "2026-10-04T15:25:00Z" }), NOW),
    ).toBe(false);
  });

  it("is overdue once the expected run is past the grace period", () => {
    expect(
      isCronJobOverdue(job({ lastRun: "2026-10-04T15:00:00Z" }), NOW),
    ).toBe(true);
  });

  it("measures a job that never ran from its registration", () => {
    expect(
      isCronJobOverdue(
        job({ createdAt: "2026-10-04T09:51:00Z", schedule: "*/5 * * * *" }),
        NOW,
      ),
    ).toBe(true);
    expect(
      isCronJobOverdue(
        job({ createdAt: "2026-10-04T15:30:00Z", schedule: "*/5 * * * *" }),
        NOW,
      ),
    ).toBe(false);
  });

  it("does not flag a daily job before its next slot", () => {
    expect(
      isCronJobOverdue(
        job({ lastRun: "2026-10-04T03:20:00Z", schedule: "20 3 * * *" }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("getCronHealth", () => {
  it("reports a healthy scheduler", () => {
    expect(
      getCronHealth(
        [
          job({ lastRun: "2026-10-04T15:34:00Z" }),
          job({ lastRun: "2026-10-04T15:00:00Z", schedule: "0 * * * *" }),
        ],
        NOW,
      ),
    ).toEqual({
      jobs: 2,
      lastRun: new Date("2026-10-04T15:34:00Z"),
      nextRun: new Date("2026-10-04T15:35:00Z"),
      overdueJobs: 0,
      stale: false,
    });
  });

  it("is stale when nothing ran since a job came due, even if a job was just registered", () => {
    expect(
      getCronHealth(
        [
          job({ lastRun: "2026-09-06T16:41:00Z" }),
          job({ lastRun: "2026-09-06T16:00:00Z", schedule: "0 * * * *" }),
          job({ createdAt: "2026-10-04T09:51:00Z", schedule: "*/5 * * * *" }),
        ],
        NOW,
      ),
    ).toEqual({
      jobs: 3,
      lastRun: new Date("2026-09-06T16:41:00Z"),
      nextRun: null,
      overdueJobs: 3,
      stale: true,
    });
  });

  it("is stale on an install where no job has ever run", () => {
    expect(
      getCronHealth([job({ createdAt: "2026-10-04T12:00:00Z" })], NOW),
    ).toMatchObject({ lastRun: null, overdueJobs: 1, stale: true });
  });

  it("separates one failing job from a stopped scheduler", () => {
    expect(
      getCronHealth(
        [
          job({ lastRun: "2026-10-04T15:34:00Z" }),
          job({ lastRun: "2026-10-04T12:00:00Z", schedule: "0 * * * *" }),
        ],
        NOW,
      ),
    ).toMatchObject({ overdueJobs: 1, stale: false });
  });

  it("points at the earliest upcoming run, skipping overdue jobs", () => {
    expect(
      getCronHealth(
        [
          job({ lastRun: "2026-10-04T12:00:00Z", schedule: "0 * * * *" }),
          job({ lastRun: "2026-10-04T15:30:00Z", schedule: "*/10 * * * *" }),
          job({ lastRun: "2026-10-04T03:20:00Z", schedule: "20 3 * * *" }),
        ],
        NOW,
      ).nextRun,
    ).toEqual(new Date("2026-10-04T15:40:00Z"));
  });

  it("is healthy without any registered job", () => {
    expect(getCronHealth([], NOW)).toEqual({
      jobs: 0,
      lastRun: null,
      nextRun: null,
      overdueJobs: 0,
      stale: false,
    });
  });
});
