import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import { resolveStaffPermissions } from "@/api/lib/check-staff-permission";
import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";

const ROLE_LIST_READERS = [
  { module: "roles", permission: "can_view" },
  { module: "users", permission: "can_view" },
  { module: "staff_admins", permission: "can_create" },
  { module: "staff_moderators", permission: "can_create" },
] as const;

export const assertCanListRoles = async (c: Context): Promise<void> => {
  const user = c.get("admin")?.user;
  if (!user) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  const permissions = await resolveStaffPermissions(c, { type: "admin", user });
  const allowed = ROLE_LIST_READERS.some(reader =>
    hasStaffPermission(permissions, {
      plugin: CONFIG_PLUGIN.pluginId,
      ...reader,
    }),
  );

  if (!allowed) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
};
