import { describe, expect, it } from "vitest";

import {
  type BrowseAnonymouslyPolicy,
  browseAnonymouslyPolicyOf,
  isPresenceHidden,
  presenceForViewer,
  type UserPresenceSnapshot,
} from "./user-presence";

const NOW = new Date("2026-10-17T12:00:00.000Z");
const SEEN = new Date("2026-10-17T11:30:00.000Z");

const OTHER = { canViewHidden: false, isSelf: false };
const SELF = { canViewHidden: false, isSelf: true };
const STAFF = { canViewHidden: true, isSelf: false };

const snapshot = (
  overrides: Partial<UserPresenceSnapshot>,
): UserPresenceSnapshot => ({
  hideOnlineStatus: false,
  lastSeenAt: SEEN,
  online: false,
  ...overrides,
});

describe("presenceForViewer", () => {
  it.each([
    [
      "a visible online member",
      snapshot({ online: true }),
      OTHER,
      { lastSeenAt: SEEN.toISOString(), status: "online" },
    ],
    [
      "an online member with nothing persisted yet, as of now",
      snapshot({ lastSeenAt: null, online: true }),
      OTHER,
      { lastSeenAt: NOW.toISOString(), status: "online" },
    ],
    [
      "a visible offline member",
      snapshot({}),
      OTHER,
      { lastSeenAt: SEEN.toISOString(), status: "offline" },
    ],
    [
      "a member who was never seen",
      snapshot({ lastSeenAt: null }),
      OTHER,
      { lastSeenAt: null, status: "offline" },
    ],
    [
      "a hidden online member, to anybody else",
      snapshot({ hideOnlineStatus: true, online: true }),
      OTHER,
      { status: "hidden" },
    ],
    [
      "a hidden offline member, to anybody else",
      snapshot({ hideOnlineStatus: true }),
      OTHER,
      { status: "hidden" },
    ],
    [
      "a hidden member, to themselves",
      snapshot({ hideOnlineStatus: true, online: true }),
      SELF,
      { isHidden: true, lastSeenAt: SEEN.toISOString(), status: "online" },
    ],
    [
      "a hidden member, to staff who may see it",
      snapshot({ hideOnlineStatus: true }),
      STAFF,
      { isHidden: true, lastSeenAt: SEEN.toISOString(), status: "offline" },
    ],
  ])("reads %s", (_, input, viewer, expected) => {
    expect(presenceForViewer(input, viewer, NOW)).toStrictEqual(expected);
  });
});

const ALLOWS = { allowBrowseAnonymously: true, forceBrowseAnonymously: false };
const DISALLOWS = {
  allowBrowseAnonymously: false,
  forceBrowseAnonymously: false,
};
const FORCES = { allowBrowseAnonymously: false, forceBrowseAnonymously: true };

describe("browseAnonymouslyPolicyOf", () => {
  it.each([
    ["no roles", [], "allowed"],
    ["one allowing role", [ALLOWS], "allowed"],
    ["every role allowing", [ALLOWS, ALLOWS], "allowed"],
    [
      "one disallowing role among allowing ones",
      [ALLOWS, DISALLOWS],
      "disallowed",
    ],
    ["one forcing role among allowing ones", [ALLOWS, FORCES], "forced"],
    ["a forcing and a disallowing role", [DISALLOWS, FORCES], "forced"],
  ] as const)("decides %s as %s", (_, roles, expected) => {
    expect(browseAnonymouslyPolicyOf(roles)).toBe(expected);
  });
});

describe("isPresenceHidden", () => {
  it.each<[BrowseAnonymouslyPolicy, boolean, boolean]>([
    ["forced", false, true],
    ["forced", true, true],
    ["disallowed", true, false],
    ["disallowed", false, false],
    ["allowed", true, true],
    ["allowed", false, false],
  ])(
    "with the policy %s and hideOnlineStatus %s is %s",
    (policy, hideOnlineStatus, expected) => {
      expect(isPresenceHidden(policy, hideOnlineStatus)).toBe(expected);
    },
  );
});
