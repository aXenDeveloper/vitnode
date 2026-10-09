import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
  ResolvedStaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  getUserRoleIds,
  resolveStaffPermissions,
} from "@/api/lib/check-staff-permission";
import { staffPermissionKey } from "@/api/lib/staff-permission";
import { core_roles } from "@/database/roles";

interface StaffEntryTarget {
  roleId?: null | number;
  userId?: null | number;
}

const currentAdminUser = (c: Context) => {
  const user = c.get("admin")?.user;
  if (!user) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return user;
};

export const assertNotOwnStaffEntry = async (
  c: Context,
  entry: StaffEntryTarget,
  message: string,
): Promise<void> => {
  const user = currentAdminUser(c);
  const roleIds = await getUserRoleIds(c, user);

  const isSelf =
    (entry.userId != null && entry.userId === user.id) ||
    (entry.roleId != null && roleIds.includes(entry.roleId));

  if (isSelf) {
    throw new HTTPException(403, { message });
  }
};

export const assertStaffAssignableRole = async (
  c: Context,
  roleId: number,
): Promise<void> => {
  const [role] = await c
    .get("db")
    .select({ default: core_roles.default, guest: core_roles.guest })
    .from(core_roles)
    .where(eq(core_roles.id, roleId))
    .limit(1);

  if (!role) {
    throw new HTTPException(404, { message: "Role not found" });
  }

  if (role.default || role.guest) {
    throw new HTTPException(400, {
      message: "The default and guest roles cannot be given staff access.",
    });
  }
};

interface StaffEntryGrant {
  permissions: PermissionsStaffArgs[];
  unrestricted: boolean;
}

const exceedsCeiling = (
  permissions: PermissionsStaffArgs[],
  ceiling: PermissionsStaffArgs[],
): boolean => {
  const allowed = new Set(ceiling.map(staffPermissionKey));

  return permissions.some(
    permission => !allowed.has(staffPermissionKey(permission)),
  );
};

export const assertCanManageStaffEntry = async (
  c: Context,
  { type, entry }: { entry: StaffEntryGrant; type: PermissionStaffType },
): Promise<ResolvedStaffPermissionSet> => {
  const ceiling = await resolveStaffPermissions(c, {
    type,
    user: currentAdminUser(c),
  });
  if (ceiling.root) return ceiling;

  if (entry.unrestricted) {
    throw new HTTPException(403, {
      message: "Only a root administrator can manage an unrestricted entry.",
    });
  }

  if (exceedsCeiling(entry.permissions, ceiling.permissions)) {
    throw new HTTPException(403, {
      message: "You cannot manage an entry that holds a permission you lack.",
    });
  }

  return ceiling;
};

export const assertWithinStaffPrivilegeCeiling = async (
  c: Context,
  {
    type,
    current,
    requested,
  }: {
    current: StaffEntryGrant;
    requested: StaffEntryGrant;
    type: PermissionStaffType;
  },
): Promise<void> => {
  const ceiling = await assertCanManageStaffEntry(c, { type, entry: current });
  if (ceiling.root) return;

  if (requested.unrestricted) {
    throw new HTTPException(403, {
      message: "Only a root administrator can grant unrestricted access.",
    });
  }

  if (exceedsCeiling(requested.permissions, ceiling.permissions)) {
    throw new HTTPException(403, {
      message: "You cannot grant a permission you do not hold.",
    });
  }
};
