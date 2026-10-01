// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { isStaff, resolveStaffPermissions } from "./check-staff-permission";

const ROOT_ROLE = 1;
const MEMBER_ROLE = 3;
const STAFF_ROLE = 4;

const USER = { id: 7, roleId: MEMBER_ROLE };

const DELETE_POSTS = {
  module: "posts",
  permission: "can_delete",
  plugin: "@vitnode/core",
};

const staffEntry = (entry: {
  permissions?: (typeof DELETE_POSTS)[];
  roleId?: number;
  unrestricted?: boolean;
  userId?: number;
}) => ({
  permissions: [],
  roleId: null,
  unrestricted: false,
  userId: null,
  ...entry,
});

const contextWith = ({
  admin = [],
  cache = createTestCache(),
  moderator = [],
  secondaryRoleIds = [],
}: {
  admin?: ReturnType<typeof staffEntry>[];
  cache?: ReturnType<typeof createTestCache>;
  moderator?: ReturnType<typeof staffEntry>[];
  secondaryRoleIds?: number[];
}) => {
  const { db } = createMemoryDb([
    [core_users, [USER]],
    [
      core_users_secondary_roles,
      secondaryRoleIds.map(roleId => ({ roleId, userId: USER.id })),
    ],
    [
      core_roles,
      [
        { id: ROOT_ROLE, root: true },
        { id: MEMBER_ROLE, root: false },
        { id: STAFF_ROLE, root: false },
      ],
    ],
    [core_admin_permissions, admin],
    [core_moderators_permissions, moderator],
  ]);
  const values: Record<string, unknown> = { cache, db };

  return { get: (key: string) => values[key] } as unknown as Context;
};

describe("isStaff", () => {
  it("is false for a member with no staff entry", async () => {
    const c = contextWith({});

    expect(await isStaff(c, { type: "admin", userId: USER.id })).toBe(false);
    expect(await isStaff(c, { type: "moderator", userId: USER.id })).toBe(
      false,
    );
  });

  it("counts an entry with zero permissions as staff", async () => {
    const c = contextWith({ admin: [staffEntry({ userId: USER.id })] });

    expect(await isStaff(c, { type: "admin", userId: USER.id })).toBe(true);
    expect(
      await resolveStaffPermissions(c, { type: "admin", user: USER }),
    ).toEqual({ permissions: [], root: false, staff: true });
  });

  it("keeps the two staff types apart", async () => {
    const c = contextWith({
      moderator: [staffEntry({ permissions: [DELETE_POSTS], userId: USER.id })],
    });

    expect(await isStaff(c, { type: "moderator", userId: USER.id })).toBe(true);
    expect(await isStaff(c, { type: "admin", userId: USER.id })).toBe(false);
  });

  it("finds a staff entry held through a secondary role", async () => {
    const c = contextWith({
      admin: [staffEntry({ roleId: STAFF_ROLE })],
      secondaryRoleIds: [STAFF_ROLE],
    });

    expect(await isStaff(c, { type: "admin", userId: USER.id })).toBe(true);
  });

  it("makes a secondary root role staff of both types", async () => {
    const c = contextWith({ secondaryRoleIds: [ROOT_ROLE] });

    expect(await isStaff(c, { type: "admin", userId: USER.id })).toBe(true);
    expect(await isStaff(c, { type: "moderator", userId: USER.id })).toBe(true);
  });

  it("is false for a user that does not exist", async () => {
    expect(await isStaff(contextWith({}), { type: "admin", userId: 404 })).toBe(
      false,
    );
  });

  it("answers from the cache unless asked to look live", async () => {
    const cache = createTestCache();
    await grantStaffPermissions(cache, { permissions: [], userId: USER.id });
    const c = contextWith({ cache });

    expect(await isStaff(c, { type: "admin", userId: USER.id })).toBe(true);
    expect(
      await isStaff(c, { live: true, type: "admin", userId: USER.id }),
    ).toBe(false);
  });
});
