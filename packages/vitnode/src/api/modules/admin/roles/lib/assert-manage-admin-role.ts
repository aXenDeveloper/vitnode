import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import {
  assertCanManageStaffEntry,
  assertNotOwnStaffEntry,
} from "@/api/modules/admin/staff/lib/staff-entry-guards";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { manifest } from "@/manifest";

const isStaffRole = async (c: Context, roleId: number): Promise<boolean> => {
  const db = c.get("db");

  const [rootRoles, adminEntries, moderatorEntries] = await Promise.all([
    db
      .select({ id: core_roles.id })
      .from(core_roles)
      .where(and(eq(core_roles.id, roleId), eq(core_roles.root, true)))
      .limit(1),
    db
      .select({ id: core_admin_permissions.id })
      .from(core_admin_permissions)
      .where(eq(core_admin_permissions.roleId, roleId))
      .limit(1),
    db
      .select({ id: core_moderators_permissions.id })
      .from(core_moderators_permissions)
      .where(eq(core_moderators_permissions.roleId, roleId))
      .limit(1),
  ]);

  return (
    rootRoles.length > 0 ||
    adminEntries.length > 0 ||
    moderatorEntries.length > 0
  );
};

export const assertCanManageAdminRole = async (
  c: Context,
  {
    roleId,
    permission,
  }: {
    permission: "can_delete_admin" | "can_edit_admin";
    roleId: number;
  },
): Promise<void> => {
  if (!(await isStaffRole(c, roleId))) return;

  await assertStaffPermission(c, {
    type: "admin",
    plugin: manifest.id,
    module: "roles",
    permission,
  });
};

const staffTables = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

export const assertCanRemoveRoleStaffEntries = async (
  c: Context,
  roleId: number,
): Promise<void> => {
  const types: PermissionStaffType[] = ["admin", "moderator"];

  const entriesByType = await Promise.all(
    types.map(async type => {
      const table = staffTables[type];
      const entries = await c
        .get("db")
        .select({
          permissions: table.permissions,
          protected: table.protected,
          roleId: table.roleId,
          unrestricted: table.unrestricted,
          userId: table.userId,
        })
        .from(table)
        .where(eq(table.roleId, roleId));

      return entries.map(entry => ({ entry, type }));
    }),
  );
  const staffEntries = entriesByType.flat();

  if (staffEntries.some(({ entry }) => entry.protected)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  await Promise.all(
    staffEntries.map(async ({ entry, type }) => {
      await assertNotOwnStaffEntry(
        c,
        entry,
        "You cannot remove your own staff permissions.",
      );
      await assertCanManageStaffEntry(c, {
        entry: { ...entry, permissions: entry.permissions ?? [] },
        type,
      });
    }),
  );
};
