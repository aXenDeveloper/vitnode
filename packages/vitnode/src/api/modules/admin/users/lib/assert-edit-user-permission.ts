import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  assertStaffPermission,
  isStaff,
  resolveStaffPermissions,
} from "@/api/lib/check-staff-permission";
import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";

const STAFF_TYPES: PermissionStaffType[] = ["admin", "moderator"];

interface StaffGrant {
  permissions: PermissionsStaffArgs[];
  unrestricted: boolean;
}

interface RoleStaffGrants {
  admin: StaffGrant[];
  moderator: StaffGrant[];
  root: boolean;
}

const forbidden = () => new HTTPException(403, { message: "Forbidden" });

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
  const staffByType = await Promise.all(
    STAFF_TYPES.map(async type => await isStaff(c, { type, userId })),
  );
  if (!staffByType.some(Boolean)) return;

  await assertCanEditAdmin(c);
};

const loadRoleStaffGrants = async (
  c: Context,
  roleIds: number[],
): Promise<RoleStaffGrants> => {
  const db = c.get("db");

  const [rootRoles, admin, moderator] = await Promise.all([
    db
      .select({ id: core_roles.id })
      .from(core_roles)
      .where(and(inArray(core_roles.id, roleIds), eq(core_roles.root, true)))
      .limit(1),
    db
      .select({
        permissions: core_admin_permissions.permissions,
        unrestricted: core_admin_permissions.unrestricted,
      })
      .from(core_admin_permissions)
      .where(inArray(core_admin_permissions.roleId, roleIds)),
    db
      .select({
        permissions: core_moderators_permissions.permissions,
        unrestricted: core_moderators_permissions.unrestricted,
      })
      .from(core_moderators_permissions)
      .where(inArray(core_moderators_permissions.roleId, roleIds)),
  ]);

  return { admin, moderator, root: rootRoles.length > 0 };
};

const grantsStaffAccess = (grants: RoleStaffGrants): boolean =>
  grants.root || grants.admin.length > 0 || grants.moderator.length > 0;

const holdsEveryGrant = (
  holder: StaffPermissionSet,
  grants: StaffGrant[],
): boolean =>
  holder.root ||
  grants.every(
    grant =>
      !grant.unrestricted &&
      grant.permissions.every(permission =>
        hasStaffPermission(holder, permission),
      ),
  );

const assertCallerHoldsGrants = async (
  c: Context,
  grants: RoleStaffGrants,
): Promise<void> => {
  const caller = c.get("admin")?.user;
  if (!caller) throw forbidden();

  const callerAdmin = await resolveStaffPermissions(c, {
    type: "admin",
    user: caller,
  });
  if (callerAdmin.root) return;

  if (grants.root || !holdsEveryGrant(callerAdmin, grants.admin)) {
    throw forbidden();
  }

  if (grants.moderator.length === 0) return;

  const callerModerator = await resolveStaffPermissions(c, {
    type: "moderator",
    user: caller,
  });
  if (!holdsEveryGrant(callerModerator, grants.moderator)) {
    throw forbidden();
  }
};

export const assertCanAssignRoles = async (
  c: Context,
  roleIds: number[],
): Promise<void> => {
  const unique = [...new Set(roleIds)];
  if (unique.length === 0) return;

  const grants = await loadRoleStaffGrants(c, unique);
  if (!grantsStaffAccess(grants)) return;

  await assertCanEditAdmin(c);
  await assertCallerHoldsGrants(c, grants);
};

export const assertCanAssignPrimaryRole = async (
  c: Context,
  roleId: number,
): Promise<void> => {
  await assertCanAssignRoles(c, [roleId]);
};
