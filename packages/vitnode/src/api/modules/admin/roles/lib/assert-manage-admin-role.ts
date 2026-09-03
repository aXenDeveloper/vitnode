import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";

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
