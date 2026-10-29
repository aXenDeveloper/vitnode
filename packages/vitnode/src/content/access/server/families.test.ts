import { describe, expect, it } from "vitest";

import type {
  ContentAccessAction,
  ContentAccessActor,
  ContentAccessOverrides,
} from "../policy";
import type { ContentAccessFamilyState } from "./families";

import { decideContentAccess } from "../policy";
import { contentAccessScopeRequirements } from "./families";

const VIP = 4;
const GUEST: ContentAccessActor = { kind: "guest" };
const MEMBER: ContentAccessActor = {
  kind: "member",
  roleIds: [2],
  root: false,
  userId: 1,
};
const VIP_MEMBER: ContentAccessActor = { ...MEMBER, roleIds: [2, VIP] };

/** Members (view: members) > VIP (view: VIP role) and Open (no rules). */
const state = (
  rules: Record<string, ContentAccessOverrides>,
): ContentAccessFamilyState => ({
  family: { defaults: {}, id: "test.boards", kind: "container", pluginId: "p" },
  parents: new Map([
    ["1", null],
    ["2", "1"],
    ["3", "2"],
    ["4", "1"],
  ]),
  rules: new Map(Object.entries(rules)),
});

const allows = (
  family: ContentAccessFamilyState,
  actor: ContentAccessActor,
  scopeId: string,
  action: ContentAccessAction,
) =>
  decideContentAccess(
    actor,
    contentAccessScopeRequirements(family, scopeId, action),
  ).allowed;

describe("contentAccessScopeRequirements", () => {
  const hiddenRoot = state({
    "1": { view: { mode: "members" } },
    "2": { view: { mode: "roles", roleIds: [VIP] } },
  });

  // The documented table: Members (1), General (4) inheriting beside it, and
  // VIP (2) with its child (3) below Members.
  it.each([
    [GUEST, { 1: false, 2: false, 3: false, 4: false }],
    [MEMBER, { 1: true, 2: false, 3: false, 4: true }],
    [VIP_MEMBER, { 1: true, 2: true, 3: true, 4: true }],
  ])("applies every ancestor's view rule to %j", (actor, expected) => {
    expect(
      Object.fromEntries(
        ["1", "2", "3", "4"].map(id => [
          id,
          allows(hiddenRoot, actor, id, "view"),
        ]),
      ),
    ).toEqual(expected);
  });

  it("applies an ancestor's read rule to read, comment and downloads, not to view", () => {
    // The child opens read to everyone; the parent's read rule still holds.
    const family = state({
      "1": { read: { mode: "members" } },
      "2": { read: { mode: "everyone" } },
    });

    expect(
      Object.fromEntries(
        (["view", "read", "comment", "downloadAttachments"] as const).map(
          action => [action, allows(family, GUEST, "2", action)],
        ),
      ),
    ).toEqual({
      comment: false,
      downloadAttachments: false,
      read: false,
      view: true,
    });
  });

  it("names the outermost scope that keeps the actor out", () => {
    const [first] = contentAccessScopeRequirements(hiddenRoot, "3", "read");

    expect(first).toMatchObject({
      action: "view",
      scopeId: "1",
      via: "ancestor",
    });
  });

  it("lets nobody into a scope that does not exist", () => {
    expect(allows(state({}), VIP_MEMBER, "99", "view")).toBe(false);
  });
});
