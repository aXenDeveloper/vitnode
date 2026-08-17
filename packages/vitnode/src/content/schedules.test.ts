import { describe, expect, it } from "vitest";

import type { ContentScheduleTimingInput } from "./schedules";

import { CONTENT_SCHEDULE_PAST_TOLERANCE_MS } from "./const";
import { contentScheduleTimingError } from "./schedules";

const NOW = new Date("2026-08-05T10:00:00.000Z");

const check = (overrides: Partial<ContentScheduleTimingInput>) =>
  contentScheduleTimingError({
    action: "publish",
    now: NOW,
    pending: [],
    scheduledFor: new Date("2026-08-05T12:00:00.000Z"),
    ...overrides,
  });

describe("contentScheduleTimingError", () => {
  it("accepts a future time", () => {
    expect(check({})).toBeNull();
  });

  it("rejects a time well in the past", () => {
    expect(check({ scheduledFor: new Date("2026-08-05T09:00:00.000Z") })).toBe(
      "CONTENT_SCHEDULE_IN_PAST",
    );
  });

  it("accepts a time just barely in the past", () => {
    // A browser clock a minute behind the server is ordinary, and one cron tick
    // is a minute wide - "now" is what the editor meant, so it is accepted and
    // fires on the next tick.
    expect(
      check({
        scheduledFor: new Date(
          NOW.getTime() - CONTENT_SCHEDULE_PAST_TOLERANCE_MS + 1000,
        ),
      }),
    ).toBeNull();
  });

  it("rejects one just outside the tolerance", () => {
    expect(
      check({
        scheduledFor: new Date(
          NOW.getTime() - CONTENT_SCHEDULE_PAST_TOLERANCE_MS - 1000,
        ),
      }),
    ).toBe("CONTENT_SCHEDULE_IN_PAST");
  });

  it("rejects an invalid date rather than passing it to the server", () => {
    expect(check({ scheduledFor: new Date("nonsense") })).toBe(
      "CONTENT_SCHEDULE_IN_PAST",
    );
  });

  describe("ordering against a pending publish", () => {
    const pending = [
      {
        action: "publish" as const,
        scheduledFor: "2026-08-05T12:00:00.000Z",
      },
    ];

    it("accepts an unpublish after it", () => {
      expect(
        check({
          action: "unpublish",
          pending,
          scheduledFor: new Date("2026-08-05T13:00:00.000Z"),
        }),
      ).toBeNull();
    });

    it("rejects an unpublish before it", () => {
      // It would fire against a draft, no-op, and then the record would go live
      // afterwards - the opposite of what was asked for.
      expect(
        check({
          action: "unpublish",
          pending,
          scheduledFor: new Date("2026-08-05T11:00:00.000Z"),
        }),
      ).toBe("CONTENT_SCHEDULE_ORDER");
    });

    it("rejects an unpublish at exactly the same moment", () => {
      // Same tick, undefined order. Refusing is the only honest answer.
      expect(
        check({
          action: "unpublish",
          pending,
          scheduledFor: new Date("2026-08-05T12:00:00.000Z"),
        }),
      ).toBe("CONTENT_SCHEDULE_ORDER");
    });

    it("does not constrain a publish", () => {
      // Rescheduling the publish itself is not ordered against its own
      // predecessor - the old row is about to be cancelled.
      expect(
        check({ pending, scheduledFor: new Date("2026-08-05T11:00:00.000Z") }),
      ).toBeNull();
    });

    it("does not constrain an unpublish when no publish is pending", () => {
      expect(
        check({
          action: "unpublish",
          pending: [],
          scheduledFor: new Date("2026-08-05T11:00:00.000Z"),
        }),
      ).toBeNull();
    });
  });
});
