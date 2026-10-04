import { describe, expect, it } from "vitest";

import { summarizeNotificationHealth } from "./health";

const overview = ({
  adapterConfigured = true,
  cronActive = true,
  cronStale = false,
  deliveries = {},
  enabled = true,
  events = {},
  queue = {},
}: {
  adapterConfigured?: boolean;
  cronActive?: boolean;
  cronStale?: boolean;
  deliveries?: Record<string, number>;
  enabled?: boolean;
  events?: Record<string, number>;
  queue?: Record<string, number>;
} = {}) => ({
  email: { adapterConfigured, enabled },
  health: {
    cronActive,
    cronStale,
    deliveries,
    events,
    oldestPendingEventAt: null,
    queue,
  },
});

describe("summarizeNotificationHealth", () => {
  it("reports a healthy installation with no warnings", () => {
    const summary = summarizeNotificationHealth(overview());

    expect(summary.email).toBe("ready");
    expect(summary.worker).toBe("active");
    expect(summary.warnings).toEqual([]);
  });

  it("fills in zero for every status the API left out", () => {
    const summary = summarizeNotificationHealth(
      overview({ deliveries: { sent: 4 }, events: { completed: 2 } }),
    );

    expect(summary.events).toEqual({
      completed: 2,
      failed: 0,
      pending: 0,
      processing: 0,
    });
    expect(summary.deliveries).toEqual({
      failed: 0,
      pending: 0,
      sending: 0,
      sent: 4,
      skipped: 0,
    });
  });

  it("warns when cron is missing, before anything else", () => {
    const summary = summarizeNotificationHealth(
      overview({
        adapterConfigured: false,
        cronActive: false,
        cronStale: true,
      }),
    );

    expect(summary.worker).toBe("inactive");
    expect(summary.warnings.map(warning => warning.kind)).toEqual([
      "cron_inactive",
      "email_adapter_missing",
    ]);
  });

  it("calls an active but quiet cron stale", () => {
    const summary = summarizeNotificationHealth(overview({ cronStale: true }));

    expect(summary.worker).toBe("stale");
    expect(summary.warnings).toEqual([{ kind: "cron_stale" }]);
  });

  it("treats a configured adapter with email turned off as disabled, not broken", () => {
    const summary = summarizeNotificationHealth(overview({ enabled: false }));

    expect(summary.email).toBe("disabled");
    expect(summary.warnings).toEqual([]);
  });

  it("counts failures with their totals", () => {
    const summary = summarizeNotificationHealth(
      overview({ deliveries: { failed: 3 }, events: { failed: 1 } }),
    );

    expect(summary.warnings).toEqual([
      { count: 1, kind: "failed_events" },
      { count: 3, kind: "failed_deliveries" },
    ]);
  });

  it("adds up failed notification queue tasks across task names", () => {
    const summary = summarizeNotificationHealth(
      overview({
        queue: {
          "notifications-email:failed": 2,
          "notifications-email:pending": 5,
          "notifications-fanout:failed": 1,
        },
      }),
    );

    expect(summary.failedQueueTasks).toBe(3);
  });
});
