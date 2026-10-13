import { describe, expect, it } from "vitest";

import type {
  PermissionsStaffArgs,
  PermissionStaffScope,
  StaffPermissionSet,
} from "./permission-staff";

import { normalizePermissionStaffModules } from "./permission-staff";
import {
  applyScopedStaffDependencies,
  hasStaffPermission,
  holdsStaffPermission,
  mergeStaffPermissionGrants,
  staffPermissionResources,
  staffScopeCovers,
} from "./staff-permission";

const PLUGIN = "@vitnode/forum";
const MODULE = "topics";
const FAMILY = "forum.section";

const VIEW = "can_view_reports";
const MANAGE = "can_manage_reports";
const VIEW_HIDDEN = "can_view_hidden";
const HIDE = "can_hide";

const all = (family = FAMILY): PermissionStaffScope => ({
  family,
  mode: "all",
});
const only = (...ids: string[]): PermissionStaffScope => ({
  family: FAMILY,
  ids,
  mode: "selected",
});

const grant = (
  permission: string,
  scope?: PermissionStaffScope,
): PermissionsStaffArgs => ({
  module: MODULE,
  permission,
  plugin: PLUGIN,
  ...(scope ? { scope } : {}),
});

const set = (...permissions: PermissionsStaffArgs[]): StaffPermissionSet => ({
  permissions,
  root: false,
});

const check = (permission: string, id?: string) => ({
  module: MODULE,
  permission,
  plugin: PLUGIN,
  ...(id === undefined ? {} : { resource: { family: FAMILY, id } }),
});

const CATALOG = [
  {
    moderator: normalizePermissionStaffModules({
      [MODULE]: [
        { permission: VIEW, scope: FAMILY },
        { dependsOn: [VIEW], permission: MANAGE, scope: FAMILY },
        { permission: VIEW_HIDDEN, scope: FAMILY },
        { dependsOn: [VIEW_HIDDEN], permission: HIDE, scope: FAMILY },
      ],
    }),
    pluginId: PLUGIN,
  },
];

describe("hasStaffPermission with a resource", () => {
  it.each<[string, PermissionsStaffArgs, string | undefined, boolean]>([
    ["a selected grant, inside", grant(VIEW, only("a", "b")), "a", true],
    ["a selected grant, outside", grant(VIEW, only("a")), "b", false],
    [
      "a selected grant, no resource named",
      grant(VIEW, only("a")),
      undefined,
      false,
    ],
    ["an all-resources grant, any resource", grant(VIEW, all()), "z", true],
    [
      "an all-resources grant, no resource named",
      grant(VIEW, all()),
      undefined,
      true,
    ],
    ["a legacy unscoped grant, any resource", grant(VIEW), "z", true],
    [
      "a legacy unscoped grant, no resource named",
      grant(VIEW),
      undefined,
      true,
    ],
  ])("%s", (_label, held, id, expected) => {
    expect(hasStaffPermission(set(held), check(VIEW, id))).toBe(expected);
  });

  it("does not let a grant in one family answer for another family", () => {
    expect(
      hasStaffPermission(
        set(grant(VIEW, all("blog.category"))),
        check(VIEW, "a"),
      ),
    ).toBe(false);
  });

  it("answers yes to everything for root", () => {
    expect(
      hasStaffPermission({ permissions: [], root: true }, check(HIDE, "a")),
    ).toBe(true);
  });
});

describe("holdsStaffPermission", () => {
  it("is true for a permission held in any scope, without naming one", () => {
    const held = set(grant(VIEW, only("a")));

    expect(holdsStaffPermission(held, check(VIEW))).toBe(true);
    expect(holdsStaffPermission(held, check(MANAGE))).toBe(false);
  });
});

describe("staffPermissionResources", () => {
  it.each<[string, StaffPermissionSet, "all" | null | string[]]>([
    ["root", { permissions: [], root: true }, "all"],
    ["a legacy unscoped grant", set(grant(VIEW)), "all"],
    ["an all-resources grant", set(grant(VIEW, all())), "all"],
    [
      "selected grants, merged and sorted",
      set(grant(VIEW, only("c", "a")), grant(VIEW, only("b", "a"))),
      ["a", "b", "c"],
    ],
    ["another permission only", set(grant(MANAGE, all())), null],
    ["another family only", set(grant(VIEW, all("blog.category"))), null],
    ["nothing", set(), null],
  ])("answers %s", (_label, held, expected) => {
    expect(staffPermissionResources(held, check(VIEW), FAMILY)).toEqual(
      expected,
    );
  });
});

describe("staffScopeCovers", () => {
  it.each<
    [
      string,
      PermissionStaffScope | undefined,
      PermissionStaffScope | undefined,
      boolean,
    ]
  >([
    ["unscoped covers anything", undefined, only("a"), true],
    ["a scope never covers unscoped", all(), undefined, false],
    ["all covers a selection", all(), only("a", "b"), true],
    ["a selection never covers all", only("a", "b"), all(), false],
    ["a superset covers a subset", only("a", "b"), only("b"), true],
    ["a subset does not cover a superset", only("a"), only("a", "b"), false],
    ["another family covers nothing", all("blog.category"), only("a"), false],
  ])("%s", (_label, outer, inner, expected) => {
    expect(staffScopeCovers(outer, inner)).toBe(expected);
  });
});

describe("mergeStaffPermissionGrants", () => {
  it("unions the scopes of one permission granted by a user and a role", () => {
    const merged = mergeStaffPermissionGrants([
      grant(VIEW, only("b")),
      grant(VIEW, only("a", "b")),
    ]);

    expect(merged).toEqual([grant(VIEW, only("a", "b"))]);
  });

  it.each<[string, PermissionsStaffArgs[], PermissionsStaffArgs[]]>([
    [
      "all absorbs a selection",
      [grant(VIEW, only("a")), grant(VIEW, all())],
      [grant(VIEW, all())],
    ],
    [
      "an unscoped grant absorbs a scoped one before it",
      [grant(VIEW, only("a")), grant(VIEW)],
      [grant(VIEW)],
    ],
    [
      "an unscoped grant absorbs a scoped one after it",
      [grant(VIEW), grant(VIEW, only("a"))],
      [grant(VIEW)],
    ],
    [
      "grants in different families stay apart",
      [grant(VIEW, only("a")), grant(VIEW, all("blog.category"))],
      [grant(VIEW, only("a")), grant(VIEW, all("blog.category"))],
    ],
  ])("%s", (_label, grants, expected) => {
    expect(mergeStaffPermissionGrants(grants)).toEqual(expected);
  });

  it("never combines scopes across permissions", () => {
    const merged = set(
      ...mergeStaffPermissionGrants([
        grant(HIDE, only("a")),
        grant(VIEW, only("b")),
      ]),
    );

    expect(hasStaffPermission(merged, check(HIDE, "a"))).toBe(true);
    expect(hasStaffPermission(merged, check(HIDE, "b"))).toBe(false);
    expect(hasStaffPermission(merged, check(VIEW, "a"))).toBe(false);
    expect(hasStaffPermission(merged, check(VIEW, "b"))).toBe(true);
  });
});

describe("applyScopedStaffDependencies", () => {
  it.each<[string, PermissionsStaffArgs[], PermissionsStaffArgs[]]>([
    [
      "narrows a grant to where its dependency is held",
      [grant(VIEW, only("a")), grant(MANAGE, only("a", "b"))],
      [grant(VIEW, only("a")), grant(MANAGE, only("a"))],
    ],
    [
      "narrows an all-resources grant to the dependency's selection",
      [grant(VIEW, only("a")), grant(MANAGE, all())],
      [grant(VIEW, only("a")), grant(MANAGE, only("a"))],
    ],
    [
      "drops a grant whose dependency is held nowhere it applies",
      [grant(VIEW, only("b")), grant(MANAGE, only("a"))],
      [grant(VIEW, only("b"))],
    ],
    [
      "drops a grant whose dependency is missing",
      [grant(MANAGE, only("a", "b"))],
      [],
    ],
    [
      "keeps a grant whose dependency is unscoped",
      [grant(VIEW), grant(MANAGE, only("a"))],
      [grant(VIEW), grant(MANAGE, only("a"))],
    ],
    ["leaves an unscoped grant alone", [grant(MANAGE)], [grant(MANAGE)]],
  ])("%s", (_label, grants, expected) => {
    expect(applyScopedStaffDependencies(grants, CATALOG)).toEqual(expected);
  });

  it("follows each permission's own dependency, not another's", () => {
    const narrowed = applyScopedStaffDependencies(
      [
        grant(VIEW, all()),
        grant(VIEW_HIDDEN, only("a")),
        grant(HIDE, only("a", "b")),
      ],
      CATALOG,
    );

    expect(narrowed).toContainEqual(grant(HIDE, only("a")));
  });
});
