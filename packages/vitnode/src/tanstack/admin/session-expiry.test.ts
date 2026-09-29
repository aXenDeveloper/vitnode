import { describe, expect, it } from "vitest";

import {
  ADMIN_SESSION_MIN_CHECK_DELAY_MS,
  adminSessionCheckDelay,
} from "./session-expiry";

describe("adminSessionCheckDelay", () => {
  const now = Date.parse("2026-09-28T12:00:00.000Z");

  it("waits until the session expires", () => {
    expect(adminSessionCheckDelay("2026-09-28T13:00:00.000Z", now)).toBe(
      60 * 60_000,
    );
    expect(adminSessionCheckDelay(new Date(now + 90_000), now)).toBe(90_000);
  });

  it("never checks in a tight loop for an expiry already behind the clock", () => {
    expect(adminSessionCheckDelay(new Date(now - 60_000), now)).toBe(
      ADMIN_SESSION_MIN_CHECK_DELAY_MS,
    );
    expect(adminSessionCheckDelay("not a date", now)).toBe(
      ADMIN_SESSION_MIN_CHECK_DELAY_MS,
    );
  });

  it("stays inside what setTimeout can hold", () => {
    expect(
      adminSessionCheckDelay(new Date(now + 1000 * 60 * 60 * 24 * 60), now),
    ).toBe(2_147_483_647);
  });
});
