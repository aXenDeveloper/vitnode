import { describe, expect, it } from "vitest";

import type {
  ContentAccessActor,
  ContentAccessAudience,
  ContentAccessDefaultsInput,
  ContentAccessScopeLayer,
} from "./policy";

import {
  CONTENT_ACCESS_DENY_ALL,
  contentAccessRequirements,
  decideContentAccess,
  readContentAccessOverrides,
  resolveContentAccessRules,
  resolveContentAccessScopeInput,
} from "./policy";

const GUEST: ContentAccessActor = { kind: "guest" };
const member = (roleIds: number[], root = false): ContentAccessActor => ({
  kind: "member",
  roleIds,
  root,
  userId: 1,
});

const MEMBERS: ContentAccessAudience = { mode: "members" };
const ROLES_4_5: ContentAccessAudience = { mode: "roles", roleIds: [4, 5] };

const allows = (
  actor: ContentAccessActor,
  chain: ContentAccessScopeLayer[],
  action: Parameters<typeof contentAccessRequirements>[0]["action"],
  defaults: ContentAccessDefaultsInput = {},
) =>
  decideContentAccess(
    actor,
    contentAccessRequirements({ action, chain, defaults, family: "f" }),
  ).allowed;

describe("audiences", () => {
  it.each<[string, ContentAccessAudience, ContentAccessActor, boolean]>([
    ["everyone lets a guest in", { mode: "everyone" }, GUEST, true],
    ["members keeps a guest out", MEMBERS, GUEST, false],
    ["members lets any member in", MEMBERS, member([2]), true],
    ["roles keeps a guest out", ROLES_4_5, GUEST, false],
    [
      "roles keeps a member without the roles out",
      ROLES_4_5,
      member([2]),
      false,
    ],
    // Primary and secondary roles are one list: any one of them is enough.
    [
      "roles lets in a member with any listed role",
      ROLES_4_5,
      member([2, 5]),
      true,
    ],
    [
      "roles with no role left lets nobody in",
      CONTENT_ACCESS_DENY_ALL,
      member([4]),
      false,
    ],
  ])("%s", (_label, audience, actor, expected) => {
    expect(
      allows(actor, [{ id: "1", overrides: { view: audience } }], "view"),
    ).toBe(expected);
  });

  it("lets a root role past every rule, deny-all included", () => {
    const chain = [
      {
        id: "1",
        overrides: {
          downloadAttachments: CONTENT_ACCESS_DENY_ALL,
          view: CONTENT_ACCESS_DENY_ALL,
        },
      },
    ];

    expect(
      decideContentAccess(
        member([], true),
        contentAccessRequirements({
          action: "downloadAttachments",
          chain,
          defaults: {},
          family: "f",
        }),
      ),
    ).toEqual({ allowed: true, reason: "root" });
  });
});

describe("prerequisites", () => {
  // Every action open except the one named: the action and everything that
  // needs it are closed to a guest, the rest stay open.
  it.each([
    [
      "view",
      { comment: false, downloadAttachments: false, read: false, view: false },
    ],
    [
      "read",
      { comment: false, downloadAttachments: false, read: false, view: true },
    ],
    [
      "comment",
      { comment: false, downloadAttachments: true, read: true, view: true },
    ],
    [
      "downloadAttachments",
      { comment: true, downloadAttachments: false, read: true, view: true },
    ],
  ] as const)(
    "closing %s to guests closes what needs it",
    (closed, expected) => {
      const chain = [{ id: "1", overrides: { [closed]: MEMBERS } }];

      expect({
        comment: allows(GUEST, chain, "comment"),
        downloadAttachments: allows(GUEST, chain, "downloadAttachments"),
        read: allows(GUEST, chain, "read"),
        view: allows(GUEST, chain, "view"),
      }).toEqual(expected);
    },
  );

  it("keeps out a role allowed to comment but not to read", () => {
    const chain = [
      {
        id: "1",
        overrides: {
          comment: ROLES_4_5,
          read: { mode: "roles", roleIds: [9] },
        },
      },
    ] satisfies ContentAccessScopeLayer[];

    expect(allows(member([4]), chain, "comment")).toBe(false);
  });
});

describe("readContentAccessOverrides", () => {
  it("fails closed on a stored rule that no longer parses", () => {
    expect(
      readContentAccessOverrides({
        comment: { mode: "vip" },
        read: { mode: "roles" },
        view: { mode: "members" },
      }),
    ).toEqual({
      comment: CONTENT_ACCESS_DENY_ALL,
      read: CONTENT_ACCESS_DENY_ALL,
      view: { mode: "members" },
    });
  });

  it.each([null, "members", ["view"], 7])(
    "reads %j as no rules at all",
    value => {
      expect(readContentAccessOverrides(value)).toEqual({});
    },
  );

  it("leaves an action without a rule to inherit", () => {
    expect(
      readContentAccessOverrides({ read: null, view: { mode: "everyone" } }),
    ).toEqual({ view: { mode: "everyone" } });
  });
});

describe("resolveContentAccessRules", () => {
  it("takes each action from the scope, the nearest ancestor, the defaults, then everyone", () => {
    const { policy, sources } = resolveContentAccessRules({
      chain: [
        { id: "child", overrides: { view: ROLES_4_5 } },
        { id: "parent", overrides: { read: MEMBERS, view: MEMBERS } },
        { id: "root", overrides: { read: CONTENT_ACCESS_DENY_ALL } },
      ],
      defaults: { comment: { mode: "members" } },
    });

    expect(policy).toEqual({
      comment: MEMBERS,
      downloadAttachments: { mode: "everyone" },
      read: MEMBERS,
      view: ROLES_4_5,
    });
    expect(sources).toEqual({
      comment: { kind: "default" },
      downloadAttachments: { kind: "fallback" },
      read: { kind: "scope", scopeId: "parent" },
      view: { kind: "scope", scopeId: "child" },
    });
  });
});

describe("resolveContentAccessScopeInput", () => {
  it.each([
    [undefined, { defaults: {}, enabled: false }],
    [false, { defaults: {}, enabled: false }],
    [true, { defaults: {}, enabled: true }],
    [
      { defaults: { comment: { mode: "members" } } },
      { defaults: { comment: { mode: "members" } }, enabled: true },
    ],
  ] as const)("resolves %j", (input, expected) => {
    expect(resolveContentAccessScopeInput(input)).toEqual(expected);
  });

  it("refuses a roles default, which only an installation can name", () => {
    expect(() =>
      resolveContentAccessScopeInput({
        defaults: {
          read: { mode: "roles", roleIds: [1] },
        } as unknown as ContentAccessDefaultsInput,
      }),
    ).toThrow(/roles are chosen in the AdminCP/);
  });
});
