import type { Context } from "hono";

import { and, eq, inArray, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
  ResolvedStaffPermissionSet,
} from "./permission-staff";

import { hasStaffPermission, staffPermissionKey } from "./staff-permission";
import {
  readStaffPermissions,
  writeStaffPermissions,
} from "./staff-permission-cache";

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

interface StaffUser {
  id: number;
  roleId: number;
}

export const getUserRoleIds = async (
  c: Context,
  user: StaffUser,
): Promise<number[]> => {
  const secondary = await c
    .get("db")
    .select({ roleId: core_users_secondary_roles.roleId })
    .from(core_users_secondary_roles)
    .where(eq(core_users_secondary_roles.userId, user.id));

  return [...new Set([user.roleId, ...secondary.map(row => row.roleId)])];
};

const loadStaffPermissions = async (
  c: Context,
  { type, user }: { type: PermissionStaffType; user: StaffUser },
): Promise<ResolvedStaffPermissionSet> => {
  const roleIds = await getUserRoleIds(c, user);

  const rootRoles = await c
    .get("db")
    .select({ id: core_roles.id })
    .from(core_roles)
    .where(and(inArray(core_roles.id, roleIds), eq(core_roles.root, true)))
    .limit(1);

  if (rootRoles.length > 0) {
    return { root: true, permissions: [], staff: true };
  }

  const table = tableByType[type];
  const entries = await c
    .get("db")
    .select({
      unrestricted: table.unrestricted,
      permissions: table.permissions,
    })
    .from(table)
    .where(or(eq(table.userId, user.id), inArray(table.roleId, roleIds)));

  if (entries.some(entry => entry.unrestricted)) {
    return { root: true, permissions: [], staff: true };
  }

  const seen = new Set<string>();
  const permissions: PermissionsStaffArgs[] = [];
  for (const entry of entries) {
    for (const permission of entry.permissions ?? []) {
      const key = staffPermissionKey(permission);
      if (seen.has(key)) continue;
      seen.add(key);
      permissions.push(permission);
    }
  }

  return { root: false, permissions, staff: entries.length > 0 };
};

const loadAndCacheStaffPermissions = async (
  c: Context,
  args: { type: PermissionStaffType; user: StaffUser },
): Promise<ResolvedStaffPermissionSet> => {
  const resolved = await loadStaffPermissions(c, args);
  await writeStaffPermissions(
    c,
    { type: args.type, userId: args.user.id },
    resolved,
  );

  return resolved;
};

export const resolveStaffPermissions = async (
  c: Context,
  { type, user }: { type: PermissionStaffType; user: StaffUser },
): Promise<ResolvedStaffPermissionSet> =>
  (await readStaffPermissions(c, { type, userId: user.id })) ??
  (await loadAndCacheStaffPermissions(c, { type, user }));

const findStaffUser = async (
  c: Context,
  userId: number,
): Promise<null | StaffUser> => {
  const [user] = await c
    .get("db")
    .select({ id: core_users.id, roleId: core_users.roleId })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return user ?? null;
};

export const isStaff = async (
  c: Context,
  {
    live = false,
    type,
    userId,
  }: { live?: boolean; type: PermissionStaffType; userId: number },
): Promise<boolean> => {
  const cached = live ? null : await readStaffPermissions(c, { type, userId });
  if (cached) return cached.staff;

  const user = await findStaffUser(c, userId);
  if (!user) return false;

  const resolved = live
    ? await loadStaffPermissions(c, { type, user })
    : await loadAndCacheStaffPermissions(c, { type, user });

  return resolved.staff;
};

export const checkStaffPermission = async (
  c: Context,
  { type, ...args }: PermissionsStaffArgs & { type: PermissionStaffType },
): Promise<boolean> => {
  const user = type === "admin" ? c.get("admin")?.user : c.get("user");
  if (!user) return false;

  const set = await resolveStaffPermissions(c, { type, user });

  return hasStaffPermission(set, args);
};

export const assertStaffPermission = async (
  c: Context,
  args: PermissionsStaffArgs & { type: PermissionStaffType },
): Promise<void> => {
  const allowed = await checkStaffPermission(c, args);
  if (!allowed) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
};
