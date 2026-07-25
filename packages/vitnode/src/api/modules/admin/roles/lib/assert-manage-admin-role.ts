import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";

/**
 * A role grants admin access when it has a row in `core_admin_permissions`.
 * Editing or deleting such a role is a higher-privilege action, so it requires
 * the elevated `_admin` variant of the permission on top of the base route
 * guard - mirroring how editing an admin *user* requires `users:can_edit_admin`
 * (see `assertCanAssignPrimaryRole`).
 *
 * Roles that do not grant admin access pass through untouched.
 */
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
  const [adminRole] = await c
    .get("db")
    .select({ id: core_admin_permissions.id })
    .from(core_admin_permissions)
    .where(eq(core_admin_permissions.roleId, roleId))
    .limit(1);

  if (!adminRole) return;

  await assertStaffPermission(c, {
    type: "admin",
    plugin: CONFIG_PLUGIN.pluginId,
    module: "roles",
    permission,
  });
};
