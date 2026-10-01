import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { assertCanManageAdminRole } from "./assert-manage-admin-role";

const ADMIN = { id: 1, roleId: 1 };
const ROLE_ID = 9;

const roles = (permission: string): PermissionsStaffArgs => ({
  module: "roles",
  permission,
  plugin: "@vitnode/core",
});

interface StaffRole {
  admin?: boolean;
  moderator?: boolean;
  root?: boolean;
}

const manage = async (
  staff: StaffRole,
  permission: "can_delete_admin" | "can_edit_admin",
  granted: PermissionsStaffArgs[],
): Promise<void> => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: granted,
    userId: ADMIN.id,
  });

  const entry = { id: 1, roleId: ROLE_ID };
  const { db } = createMemoryDb([
    [core_roles, [{ id: ROLE_ID, root: staff.root ?? false }]],
    [core_admin_permissions, staff.admin ? [entry] : []],
    [core_moderators_permissions, staff.moderator ? [entry] : []],
  ]);
  const values: Record<string, unknown> = { admin: { user: ADMIN }, cache, db };

  await assertCanManageAdminRole(
    { get: (key: string) => values[key] } as Context,
    { permission, roleId: ROLE_ID },
  );
};

const staffRoles: [string, StaffRole][] = [
  ["a root role without an admin entry", { root: true }],
  ["a role with a moderator entry", { moderator: true }],
  ["a role with an admin entry", { admin: true }],
];

describe("assertCanManageAdminRole", () => {
  it.each(staffRoles)(
    "requires roles:can_edit_admin to edit %s",
    async (_label, staff) => {
      await expect(
        manage(staff, "can_edit_admin", [roles("can_view"), roles("can_edit")]),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        manage(staff, "can_edit_admin", [roles("can_edit_admin")]),
      ).resolves.toBeUndefined();
    },
  );

  it.each(staffRoles)(
    "requires roles:can_delete_admin to delete %s",
    async (_label, staff) => {
      await expect(
        manage(staff, "can_delete_admin", [
          roles("can_view"),
          roles("can_delete"),
        ]),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        manage(staff, "can_delete_admin", [roles("can_delete_admin")]),
      ).resolves.toBeUndefined();
    },
  );

  it("asks nothing elevated for an ordinary role", async () => {
    await expect(manage({}, "can_edit_admin", [])).resolves.toBeUndefined();
  });
});
