import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";

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
    plugin: CONFIG_PLUGIN.pluginId,
    module: "roles",
    permission,
  });
};
