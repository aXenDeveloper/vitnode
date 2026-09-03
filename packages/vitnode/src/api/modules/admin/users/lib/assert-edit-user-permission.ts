import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";

const assertCanEditAdmin = async (c: Context): Promise<void> => {
  await assertStaffPermission(c, {
    type: "admin",
    plugin: CONFIG_PLUGIN.pluginId,
    module: "users",
    permission: "can_edit_admin",
  });
};

export const assertCanEditAdminTarget = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const isTargetAdmin = await new SessionAdminModel(c).checkIfUserIsAdmin(
    userId,
  );
  if (!isTargetAdmin) return;

  await assertCanEditAdmin(c);
};

export const assertCanAssignPrimaryRole = async (
  c: Context,
  roleId: number,
): Promise<void> => {
  const [adminRole] = await c
    .get("db")
    .select({ id: core_admin_permissions.id })
    .from(core_admin_permissions)
    .where(eq(core_admin_permissions.roleId, roleId))
    .limit(1);

  if (!adminRole) return;

  await assertCanEditAdmin(c);
};
