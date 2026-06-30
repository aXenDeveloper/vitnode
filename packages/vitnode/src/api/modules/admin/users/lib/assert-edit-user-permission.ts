import type { Context } from "hono";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONFIG_PLUGIN } from "@/config";

export const assertCanEditAdminTarget = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const isTargetAdmin = await new SessionAdminModel(c).checkIfUserIsAdmin(
    userId,
  );
  if (!isTargetAdmin) return;

  await assertStaffPermission(c, {
    type: "admin",
    plugin: CONFIG_PLUGIN.pluginId,
    module: "users",
    permission: "can_edit_admin",
  });
};
