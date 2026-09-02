import { describe, expect, it } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";
import { adminQueryRoot } from "@/views/admin/table/query";

import type { AdminRolesPage } from "./roles/roles-query";

import {
  adminUserQueryKey,
  canEditAdminUser,
  normalizeAdminUserId,
} from "./detail/user-query";
import {
  adminUsersQueryKey,
  adminUsersQueryRoot,
  normalizeAdminRoleFilter,
  normalizeAdminUsersParams,
} from "./list/users-query";
import { adminRoleOptionsFrom } from "./roles/roles-query";
import { adminUserCreateConflictField } from "./users-mutations";

const CORE = "@vitnode/core";

const permissionSet = (...permissions: string[]): StaffPermissionSet => ({
  permissions: permissions.map(permission => ({
    module: "users",
    permission,
    plugin: CORE,
  })),
  root: false,
});

describe("a user id out of the URL", () => {
  it.each(["1", "42", "2147483647"])("accepts %o", raw => {
    expect(normalizeAdminUserId(raw)).toBe(raw);
  });

  it.each([
    ["abc", "Number() would make this NaN"],
    ["1e3", "Number() would make this 1000"],
    ["0x10", "Number() would make this 16"],
    ["-1", "no row has a negative id"],
    ["0", "no row has id zero"],
    ["012", "a second spelling of one id"],
    ["7 ", "trailing whitespace Number() would ignore"],
    ["", "Number('') is 0"],
    ["2147483648", "past a Postgres integer"],
    ["../../etc", "a traversal attempt"],
  ])("refuses %o (%s)", raw => {
    expect(normalizeAdminUserId(raw)).toBeNull();
  });

  it("refuses anything that is not a string", () => {
    expect(normalizeAdminUserId(undefined)).toBeNull();
    expect(normalizeAdminUserId(null)).toBeNull();
  });

  it("takes the first of a repeated parameter", () => {
    expect(normalizeAdminUserId(["3", "9"])).toBe("3");
  });
});

describe("who may edit a user", () => {
  it("needs can_edit at all", () => {
    expect(
      canEditAdminUser(EMPTY_STAFF_PERMISSION_SET, { isAdmin: false }),
    ).toBe(false);
    expect(
      canEditAdminUser(permissionSet("can_edit"), { isAdmin: false }),
    ).toBe(true);
  });

  it("needs can_edit_admin as well when the target is an administrator", () => {
    expect(canEditAdminUser(permissionSet("can_edit"), { isAdmin: true })).toBe(
      false,
    );
    expect(
      canEditAdminUser(permissionSet("can_edit", "can_edit_admin"), {
        isAdmin: true,
      }),
    ).toBe(true);
  });

  it("does not let can_edit_admin stand in for can_edit", () => {
    expect(
      canEditAdminUser(permissionSet("can_edit_admin"), { isAdmin: false }),
    ).toBe(false);
  });

  it("lets root through both gates", () => {
    expect(
      canEditAdminUser({ permissions: [], root: true }, { isAdmin: true }),
    ).toBe(true);
  });

  it("ignores a permission granted under another plugin", () => {
    expect(
      canEditAdminUser(
        {
          permissions: [
            {
              module: "users",
              permission: "can_edit",
              plugin: "@vitnode/blog",
            },
          ],
          root: false,
        },
        { isAdmin: false },
      ),
    ).toBe(false);
  });
});

describe("the role filter in the URL", () => {
  it("keeps a list of ids", () => {
    expect(normalizeAdminRoleFilter("2,5")).toBe("2,5");
  });

  it("sorts and de-duplicates, so one selection is one cache entry", () => {
    expect(normalizeAdminRoleFilter("5,2,5")).toBe("2,5");
  });

  it.each(["abc", "", ",", "0", "-3", "1.5", "NaN"])(
    "drops %o rather than filtering by NaN",
    raw => {
      expect(normalizeAdminRoleFilter(raw)).toBeUndefined();
    },
  );

  it("keeps the ids out of a mixed list", () => {
    expect(normalizeAdminRoleFilter("2,abc,5")).toBe("2,5");
  });

  it("is absent rather than empty when nothing is selected", () => {
    expect(normalizeAdminUsersParams({ roleId: "" })).not.toHaveProperty(
      "roleId",
    );
  });
});

describe("the users list request", () => {
  it("always names a page size, so the key describes the request", () => {
    expect(normalizeAdminUsersParams()).toEqual({ first: "10" });
  });

  it("keeps the sort the table offers", () => {
    expect(
      normalizeAdminUsersParams({ order: "asc", orderBy: "name" }),
    ).toMatchObject({ order: "asc", orderBy: "name" });
  });

  it("drops a sort column the API would refuse", () => {
    expect(normalizeAdminUsersParams({ orderBy: "email" })).not.toHaveProperty(
      "orderBy",
    );
  });

  it("treats a blank search as no search", () => {
    expect(normalizeAdminUsersParams({ search: "   " })).not.toHaveProperty(
      "search",
    );
  });

  it("is idempotent, because the router re-validates every location", () => {
    const once = normalizeAdminUsersParams({
      first: "20",
      roleId: "5,2",
      search: " ann ",
    });

    expect(normalizeAdminUsersParams(once)).toEqual(once);
  });
});

describe("cache partitioning", () => {
  it("hangs off the AdminCP root, so a sign-out collects it", () => {
    expect(
      adminUsersQueryRoot(7).slice(0, adminQueryRoot("users").length),
    ).toEqual([...adminQueryRoot("users")]);
  });

  it("gives two administrators two entries for one request", () => {
    const params = normalizeAdminUsersParams();

    expect(adminUsersQueryKey({ adminUserId: 7, params })).not.toEqual(
      adminUsersQueryKey({ adminUserId: 8, params }),
    );
  });

  it("gives one administrator one entry for one request", () => {
    expect(
      adminUsersQueryKey({
        adminUserId: 7,
        params: normalizeAdminUsersParams(),
      }),
    ).toEqual(
      adminUsersQueryKey({
        adminUserId: 7,
        params: normalizeAdminUsersParams({ first: "10" }),
      }),
    );
  });

  it("keeps an unauthenticated read in its own partition", () => {
    const params = normalizeAdminUsersParams();

    expect(adminUsersQueryKey({ adminUserId: null, params })).not.toEqual(
      adminUsersQueryKey({ adminUserId: 0, params }),
    );
  });

  it("does not let the list and one user collide", () => {
    expect(adminUserQueryKey({ adminUserId: 7, id: "3" })).not.toEqual(
      adminUsersQueryKey({
        adminUserId: 7,
        params: normalizeAdminUsersParams(),
      }),
    );
  });

  it("never puts the identity anywhere near the request", () => {
    // The administrator's id partitions the cache key and nothing else - the
    // call site sends `args: { query: params }`, and the API answers from the
    // cookie.
    expect(
      JSON.stringify(normalizeAdminUsersParams({ roleId: "2" })),
    ).not.toContain("7");
  });
});

describe("the role search", () => {
  const page = {
    edges: [
      {
        color: null,
        guest: false,
        id: 1,
        name: [{ languageCode: "en", name: "Member" }],
      },
      {
        color: "#fff",
        guest: true,
        id: 2,
        name: [{ languageCode: "en", name: "Guest" }],
      },
      {
        color: "#f00",
        guest: false,
        id: 3,
        name: [{ languageCode: "en", name: "Admin" }],
      },
    ],
  } as unknown as AdminRolesPage;

  it("drops the guest role, which is never assignable", () => {
    expect(adminRoleOptionsFrom(page).map(role => role.id)).toEqual([1, 3]);
  });

  it("keeps every translation of the name for the reader to resolve", () => {
    expect(adminRoleOptionsFrom(page)[0]).toEqual({
      color: null,
      id: 1,
      name: [{ languageCode: "en", name: "Member" }],
    });
  });

  it("carries nothing the picker does not need", () => {
    expect(Object.keys(adminRoleOptionsFrom(page)[0]).sort()).toEqual([
      "color",
      "id",
      "name",
    ]);
  });

  it("answers an empty page with an empty list", () => {
    expect(adminRoleOptionsFrom({ edges: [] })).toEqual([]);
  });
});

describe("a create conflict", () => {
  it.each([
    ["Email already exists", "email"],
    ["Name already exists", "name"],
    ["name already exists", "name"],
  ] as const)("puts %o on the %s field", (message, field) => {
    expect(adminUserCreateConflictField(message)).toBe(field);
  });

  it("does not guess at a message it does not recognise", () => {
    expect(adminUserCreateConflictField("Something went wrong")).toBeNull();
  });
});
