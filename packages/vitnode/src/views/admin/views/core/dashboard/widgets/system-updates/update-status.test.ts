import { describe, expect, it } from "vitest";

import { updateSummary as summary } from "@/tests/update-summary";

import { compactVersion, updateStatusOf } from "./update-status";

describe("updateStatusOf", () => {
  it.each([
    ["disabled", summary({ enabled: false, running: true })],
    [
      "running",
      summary({ checkedComponents: 0, notCheckedComponents: 2, running: true }),
    ],
    ["not_checked", summary({ checkedComponents: 0, notCheckedComponents: 2 })],
    ["unavailable", summary({ checkedComponents: 0 })],
    ["security", summary({ affectedComponents: 1, updatesAvailable: 2 })],
    ["updates", summary({ unconfirmedComponents: 1, updatesAvailable: 2 })],
    ["unconfirmed", summary({ unconfirmedComponents: 1 })],
    ["no_info", summary({ unconfirmedComponents: 3 })],
    ["up_to_date", summary()],
  ])("returns %s", (status, data) => {
    expect(updateStatusOf(data)).toBe(status);
  });
});

describe("compactVersion", () => {
  it.each([
    ["2.0.0-canary.4", "2.0.0-canary.7", "canary.7"],
    ["1.9.0-canary.4", "2.0.0-canary.7", "2.0.0-canary.7"],
    ["2.0.0", "2.1.0", "2.1.0"],
    ["2.0.0", "2.0.0-canary.7", "2.0.0-canary.7"],
    [null, "2.0.0-canary.7", "2.0.0-canary.7"],
  ])("shortens %s -> %s to %s", (current, latest, expected) => {
    expect(compactVersion(current, latest)).toBe(expected);
  });
});
