import { describe, expect, it } from "vitest";

import type { StaffCatalog, StaffPermissionItem } from "./staff-model";

import {
  buildStaffPermissionGroups,
  chunkStaffLabelKeys,
  countGrantedStaffPermissions,
  grantedStaffPermissionKeys,
  isStaffPermissionLocked,
  normalizeStaffEntryId,
  setStaffPermissionsChecked,
  STAFF_TYPE_SEGMENT,
  staffBreadcrumbLabels,
  staffCreateHref,
  staffEditHref,
  staffLabelKeys,
  staffLabelLookupFrom,
  staffListHref,
  staffPermissionDependents,
  staffPermissionItems,
  staffPermissionsForSubmit,
  staffTypeFromSegment,
  toggleStaffPermission,
} from "./staff-model";

const CORE = "@vitnode/core";

const catalog: StaffCatalog = [
  {
    admin: {
      users: [
        { dependsOn: [], permission: "can_view" },
        { dependsOn: ["can_view"], permission: "can_edit" },
        { dependsOn: ["can_edit"], permission: "can_edit_admin" },
      ],
      // Present for administrators, absent for moderators - the filter below
      // has to notice.
      staff_admins: [{ dependsOn: [], permission: "can_view" }],
    },
    moderator: {
      users: [{ dependsOn: [], permission: "can_view" }],
      // A module with nothing in it must not become an empty section.
      reports: [],
    },
    pluginId: CORE,
  },
  {
    // A plugin with admin permissions only: it must vanish from the moderator
    // tree entirely rather than render as an empty plugin.
    admin: { posts: [{ dependsOn: [], permission: "can_view" }] },
    moderator: {},
    pluginId: "@vitnode/blog",
  },
];

const label = staffLabelLookupFrom({
  [CORE]: { title: "Core" },
  [`${CORE}:users`]: "Users",
  [`${CORE}:users:can_edit`]: "Edit users",
  [`${CORE}:users:can_view`]: "View users list",
});

const adminGroups = () =>
  buildStaffPermissionGroups({ catalog, label, type: "admin" });

describe("where a staff screen lives", () => {
  it("maps the API's type to the URL's segment", () => {
    expect(STAFF_TYPE_SEGMENT).toEqual({
      admin: "admins",
      moderator: "moderators",
    });
  });

  it.each([
    ["admins", "admin"],
    ["moderators", "moderator"],
  ] as const)("reads %s back as %s", (segment, type) => {
    expect(staffTypeFromSegment(segment)).toBe(type);
  });

  it.each(["admin", "moderator", "", "Admins", "../admins"])(
    "refuses %o as a segment",
    segment => {
      expect(staffTypeFromSegment(segment)).toBeNull();
    },
  );

  it("builds the three destinations off one list href", () => {
    expect(staffListHref("admin")).toBe("/admin/core/staff/admins");
    expect(staffCreateHref("moderator")).toBe(
      "/admin/core/staff/moderators/create",
    );
    expect(staffEditHref("admin", 12)).toBe("/admin/core/staff/admins/edit/12");
  });

  it("takes an id as a string as readily as a number", () => {
    expect(staffEditHref("moderator", "7")).toBe(
      "/admin/core/staff/moderators/edit/7",
    );
  });

  it("names the two crumbs the URL cannot", () => {
    expect(
      staffBreadcrumbLabels({
        listLabel: "Administrators",
        staffLabel: "Staff",
        type: "admin",
      }),
    ).toEqual({
      "/admin/core/staff": "Staff",
      "/admin/core/staff/admins": "Administrators",
    });
  });
});

describe("a staff entry id out of the URL", () => {
  it.each(["1", "12", "2147483647"])("accepts %o", raw => {
    expect(normalizeStaffEntryId(raw)).toBe(raw);
  });

  it.each([
    ["abc", "not a number at all"],
    ["1e3", "exponent notation Number() would accept"],
    ["-1", "negative"],
    ["0", "no row has id zero"],
    ["007", "a second spelling of one id"],
    [" 7", "whitespace"],
    ["7.0", "a float"],
    ["2147483648", "past a Postgres integer"],
    ["", "empty"],
  ])("refuses %o (%s)", raw => {
    expect(normalizeStaffEntryId(raw)).toBeNull();
  });

  it("refuses a missing or repeated parameter", () => {
    expect(normalizeStaffEntryId(undefined)).toBeNull();
    expect(normalizeStaffEntryId(null)).toBeNull();
    expect(normalizeStaffEntryId(["1", "2"])).toBe("1");
  });
});

describe("building the permission tree", () => {
  it("keeps only the modules declared for the staff type", () => {
    const moderator = buildStaffPermissionGroups({
      catalog,
      label,
      type: "moderator",
    });

    expect(moderator.map(plugin => plugin.pluginId)).toEqual([CORE]);
    expect(moderator[0].modules.map(module => module.module)).toEqual([
      "users",
    ]);
  });

  it("drops a plugin whose modules are all empty for this type", () => {
    expect(
      buildStaffPermissionGroups({ catalog, label, type: "moderator" }).some(
        plugin => plugin.pluginId === "@vitnode/blog",
      ),
    ).toBe(false);
  });

  it("resolves dependencies to full keys within the same module", () => {
    const users = adminGroups()[0].modules[0];

    expect(users.permissions[1]).toMatchObject({
      dependsOn: [`${CORE}:users:can_view`],
      key: `${CORE}:users:can_edit`,
    });
  });

  it("translates what it can and falls back to the identifier", () => {
    const [core] = adminGroups();

    expect(core.label).toBe("Core");
    expect(core.modules[0].label).toBe("Users");
    // No message for `can_edit_admin`, so the raw permission survives rather
    // than a blank row nobody could identify.
    expect(core.modules[0].permissions[2].label).toBe("can_edit_admin");
    // No message for the module at all.
    expect(core.modules[1].label).toBe("staff_admins");
  });

  it("falls back to the plugin id when it has no title", () => {
    const [, blog] = adminGroups();

    expect(blog.label).toBe("@vitnode/blog");
  });

  it("flattens to every permission in the tree", () => {
    expect(staffPermissionItems(adminGroups()).map(item => item.key)).toEqual([
      `${CORE}:users:can_view`,
      `${CORE}:users:can_edit`,
      `${CORE}:users:can_edit_admin`,
      `${CORE}:staff_admins:can_view`,
      "@vitnode/blog:posts:can_view",
    ]);
  });

  it("reads an entry's granted set back as keys", () => {
    expect([
      ...grantedStaffPermissionKeys([
        { module: "users", permission: "can_view", plugin: CORE },
      ]),
    ]).toEqual([`${CORE}:users:can_view`]);
  });
});

describe("dependency rules", () => {
  const items = () => staffPermissionItems(adminGroups());
  const dependents = () => staffPermissionDependents(items());

  it("indexes what would break if a permission were revoked", () => {
    expect(dependents().get(`${CORE}:users:can_view`)).toEqual([
      `${CORE}:users:can_edit`,
    ]);
  });

  it("locks a permission whose dependency is not granted", () => {
    const item = items()[1];

    expect(isStaffPermissionLocked(item, new Set())).toBe(true);
    expect(
      isStaffPermissionLocked(item, new Set([`${CORE}:users:can_view`])),
    ).toBe(false);
  });

  it("never locks a permission that depends on nothing", () => {
    expect(isStaffPermissionLocked(items()[0], new Set())).toBe(false);
  });

  it("adds a single key when a permission is turned on", () => {
    expect([
      ...toggleStaffPermission({
        checked: new Set([`${CORE}:users:can_view`]),
        dependents: dependents(),
        key: `${CORE}:users:can_edit`,
        value: true,
      }),
    ]).toEqual([`${CORE}:users:can_view`, `${CORE}:users:can_edit`]);
  });

  it("cascades transitively when one is turned off", () => {
    const checked = new Set([
      `${CORE}:staff_admins:can_view`,
      `${CORE}:users:can_edit_admin`,
      `${CORE}:users:can_edit`,
      `${CORE}:users:can_view`,
    ]);

    expect([
      ...toggleStaffPermission({
        checked,
        dependents: dependents(),
        key: `${CORE}:users:can_view`,
        value: false,
      }),
    ]).toEqual([`${CORE}:staff_admins:can_view`]);
  });

  it("does not mutate the set it was given", () => {
    const checked = new Set([`${CORE}:users:can_view`]);
    toggleStaffPermission({
      checked,
      dependents: dependents(),
      key: `${CORE}:users:can_view`,
      value: false,
    });

    expect(checked.has(`${CORE}:users:can_view`)).toBe(true);
  });

  it("terminates on a dependency cycle rather than hanging", () => {
    const cyclic: StaffPermissionItem[] = [
      {
        dependsOn: ["p:m:b"],
        key: "p:m:a",
        label: "a",
        module: "m",
        permission: "a",
        plugin: "p",
      },
      {
        dependsOn: ["p:m:a"],
        key: "p:m:b",
        label: "b",
        module: "m",
        permission: "b",
        plugin: "p",
      },
    ];

    expect([
      ...toggleStaffPermission({
        checked: new Set(["p:m:a", "p:m:b"]),
        dependents: staffPermissionDependents(cyclic),
        key: "p:m:a",
        value: false,
      }),
    ]).toEqual([]);
  });

  it("ticks and clears a whole module at once", () => {
    const keys = adminGroups()[0].modules[0].permissions.map(
      permission => permission.key,
    );

    const all = setStaffPermissionsChecked({
      checked: new Set(),
      keys,
      value: true,
    });
    expect(all.size).toBe(3);

    expect(
      setStaffPermissionsChecked({ checked: all, keys, value: false }).size,
    ).toBe(0);
  });

  it("counts what is granted in a module, for the badge", () => {
    const permissions = adminGroups()[0].modules[0].permissions;

    expect(
      countGrantedStaffPermissions(
        permissions,
        new Set([`${CORE}:users:can_view`]),
      ),
    ).toBe(1);
  });
});

describe("what is submitted", () => {
  const items = () => staffPermissionItems(adminGroups());

  it("sends nothing at all when unrestricted", () => {
    expect(
      staffPermissionsForSubmit({
        checked: new Set([`${CORE}:users:can_view`]),
        items: items(),
        unrestricted: true,
      }),
    ).toEqual([]);
  });

  it("sends the tuple the API's schema takes, and only that", () => {
    expect(
      staffPermissionsForSubmit({
        checked: new Set([`${CORE}:users:can_view`]),
        items: items(),
        unrestricted: false,
      }),
    ).toEqual([{ module: "users", permission: "can_view", plugin: CORE }]);
  });

  it("drops a permission whose dependency is missing", () => {
    expect(
      staffPermissionsForSubmit({
        checked: new Set([`${CORE}:users:can_edit`]),
        items: items(),
        unrestricted: false,
      }),
    ).toEqual([]);
  });

  it("collapses a whole broken chain, not one link of it", () => {
    // `can_edit_admin` depends on `can_edit`, which depends on `can_view`. With
    // only the outer two granted, a single pass would keep `can_edit_admin`.
    expect(
      staffPermissionsForSubmit({
        checked: new Set([
          `${CORE}:users:can_edit_admin`,
          `${CORE}:users:can_edit`,
        ]),
        items: items(),
        unrestricted: false,
      }),
    ).toEqual([]);
  });

  it("ignores a key that is not in the catalog", () => {
    expect(
      staffPermissionsForSubmit({
        checked: new Set(["@vitnode/gone:module:can_view"]),
        items: items(),
        unrestricted: false,
      }),
    ).toEqual([]);
  });

  it("orders by the catalog, so two saves produce the same body", () => {
    const checked = new Set([
      `${CORE}:staff_admins:can_view`,
      `${CORE}:users:can_view`,
    ]);
    const reversed = new Set([...checked].reverse());

    expect(
      staffPermissionsForSubmit({
        checked,
        items: items(),
        unrestricted: false,
      }),
    ).toEqual(
      staffPermissionsForSubmit({
        checked: reversed,
        items: items(),
        unrestricted: false,
      }),
    );
  });
});

describe("the message keys the labels need", () => {
  it("names the plugin, every module and every permission, once", () => {
    expect(staffLabelKeys({ catalog, type: "admin" })).toEqual([
      CORE,
      `${CORE}:users`,
      `${CORE}:users:can_view`,
      `${CORE}:users:can_edit`,
      `${CORE}:users:can_edit_admin`,
      `${CORE}:staff_admins`,
      `${CORE}:staff_admins:can_view`,
      "@vitnode/blog",
      "@vitnode/blog:posts",
      "@vitnode/blog:posts:can_view",
    ]);
  });

  it("skips a plugin and a module with nothing for this type", () => {
    expect(staffLabelKeys({ catalog, type: "moderator" })).toEqual([
      CORE,
      `${CORE}:users`,
      `${CORE}:users:can_view`,
    ]);
  });

  it("splits them into requests the i18n runtime will accept", () => {
    expect(chunkStaffLabelKeys(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("chunks an empty catalog to no requests at all", () => {
    expect(chunkStaffLabelKeys([], 16)).toEqual([]);
  });

  it("refuses a chunk size that would never terminate", () => {
    expect(() => chunkStaffLabelKeys(["a"], 0)).toThrow();
  });
});

describe("looking a label up in loaded messages", () => {
  it("reads a plain string key", () => {
    expect(label(`${CORE}:users`)).toBe("Users");
  });

  it("reads a plugin heading out of its namespace object", () => {
    expect(label(`${CORE}.title`)).toBe("Core");
  });

  it("answers undefined rather than [object Object]", () => {
    const lookup = staffLabelLookupFrom({ weird: { nested: { a: 1 } } });

    expect(lookup("weird")).toBeUndefined();
  });

  it("answers undefined for a key that was never loaded", () => {
    expect(label("@vitnode/nothing:module:can_view")).toBeUndefined();
  });
});
