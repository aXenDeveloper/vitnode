import { describe, expect, it } from "vitest";

import type { WarningThresholdRule } from "./warnings";

import {
  activeWarningPoints,
  evaluateWarningThresholds,
  isSanctionActiveAt,
  thresholdSuspensionEnd,
} from "./warnings";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

const rule = (
  id: number,
  points: number,
  extra: Partial<WarningThresholdRule> = {},
): WarningThresholdRule => ({
  action: "suspend_temporary",
  durationHours: 24,
  enabled: true,
  id,
  points,
  ...extra,
});

describe("activeWarningPoints", () => {
  it("counts warnings that are neither expired nor revoked", () => {
    expect(
      activeWarningPoints(
        [
          { expiresAt: null, points: 3, revokedAt: null },
          { expiresAt: at(1), points: 2, revokedAt: null },
          { expiresAt: null, points: 0, revokedAt: null },
          { expiresAt: NOW, points: 5, revokedAt: null },
          { expiresAt: at(-1), points: 7, revokedAt: null },
          { expiresAt: null, points: 11, revokedAt: at(-2) },
          { expiresAt: at(1), points: 13, revokedAt: at(-2) },
        ],
        NOW,
      ),
    ).toBe(5);
  });
});

describe("evaluateWarningThresholds", () => {
  const eight = rule(1, 8);
  const ten = rule(2, 10, {
    action: "suspend_indefinite",
    durationHours: null,
  });
  const twelveOff = rule(3, 12, { enabled: false });
  const rules = [ten, twelveOff, eight];

  it.each([
    { after: 8, applied: eight, before: 6, crossed: [eight] },
    { after: 11, applied: ten, before: 6, crossed: [eight, ten] },
    { after: 9, applied: null, before: 8, crossed: [] },
    { after: 12, applied: null, before: 10, crossed: [] },
    { after: 7, applied: null, before: 6, crossed: [] },
    { after: 20, applied: null, before: 11, crossed: [] },
  ])(
    "applies only the highest enabled rule crossed from $before to $after",
    ({ after, applied, before, crossed }) => {
      expect(evaluateWarningThresholds({ after, before, rules })).toEqual({
        applied,
        crossed,
      });
    },
  );
});

describe("thresholdSuspensionEnd", () => {
  it.each([
    ["after its duration", rule(1, 8, { durationHours: 24 }), at(24)],
    [
      "never for an indefinite one",
      rule(2, 10, { action: "suspend_indefinite", durationHours: null }),
      null,
    ],
  ])("ends a suspension %s", (_name, threshold, end) => {
    expect(thresholdSuspensionEnd(threshold, NOW)).toEqual(end);
  });
});

describe("isSanctionActiveAt", () => {
  it.each([
    ["active and temporary", { endsAt: at(1), revokedAt: null }, true],
    ["indefinite", { endsAt: null, revokedAt: null }, true],
    ["revoked", { endsAt: null, revokedAt: at(-1) }, false],
    ["ended", { endsAt: NOW, revokedAt: null }, false],
    ["not started", { endsAt: null, revokedAt: null, startsAt: at(1) }, false],
  ])("treats a %s sanction as active: %s", (_name, sanction, active) => {
    expect(isSanctionActiveAt({ startsAt: at(-2), ...sanction }, NOW)).toBe(
      active,
    );
  });
});
