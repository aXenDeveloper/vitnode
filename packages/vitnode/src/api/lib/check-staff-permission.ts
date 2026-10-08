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
  readStaffPermissionsOfUser,
  STAFF_TYPES,
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

const rootStaffPermissions = (): ResolvedStaffPermissionSet => ({
  root: true,
  permissions: [],
  staff: true,
});

const hasRootRole = async (c: Context, roleIds: number[]): Promise<boolean> => {
  const rootRoles = await c
    .get("db")
    .select({ id: core_roles.id })
    .from(core_roles)
    .where(and(inArray(core_roles.id, roleIds), eq(core_roles.root, true)))
    .limit(1);

  return rootRoles.length > 0;
};

const findStaffEntries = async (
  c: Context,
  {
    roleIds,
    type,
    userId,
  }: { roleIds: number[]; type: PermissionStaffType; userId: number },
) => {
  const table = tableByType[type];

  return await c
    .get("db")
    .select({
      unrestricted: table.unrestricted,
      permissions: table.permissions,
    })
    .from(table)
    .where(or(eq(table.userId, userId), inArray(table.roleId, roleIds)));
};

const toStaffPermissionSet = (
  entries: Awaited<ReturnType<typeof findStaffEntries>>,
): ResolvedStaffPermissionSet => {
  if (entries.some(entry => entry.unrestricted)) {
    return rootStaffPermissions();
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

const loadStaffPermissions = async (
  c: Context,
  { type, user }: { type: PermissionStaffType; user: StaffUser },
): Promise<ResolvedStaffPermissionSet> => {
  const roleIds = await getUserRoleIds(c, user);

  if (await hasRootRole(c, roleIds)) return rootStaffPermissions();

  return toStaffPermissionSet(
    await findStaffEntries(c, { roleIds, type, userId: user.id }),
  );
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

export interface StaffFlags {
  isAdmin: boolean;
  isModerator: boolean;
}

const loadMissingStaffPermissions = async (
  c: Context,
  { types, user }: { types: PermissionStaffType[]; user: StaffUser },
): Promise<[PermissionStaffType, ResolvedStaffPermissionSet][]> => {
  const roleIds = await getUserRoleIds(c, user);
  const [root, entriesByType] = await Promise.all([
    hasRootRole(c, roleIds),
    Promise.all(
      types.map(
        async type =>
          [
            type,
            await findStaffEntries(c, { roleIds, type, userId: user.id }),
          ] as const,
      ),
    ),
  ]);

  return entriesByType.map(([type, entries]) => [
    type,
    root ? rootStaffPermissions() : toStaffPermissionSet(entries),
  ]);
};

export const getStaffFlags = async (
  c: Context,
  user: StaffUser,
): Promise<StaffFlags> => {
  const cached = await readStaffPermissionsOfUser(c, user.id);
  const sets = { ...cached.sets };
  const missing = STAFF_TYPES.filter(type => !sets[type]);

  if (missing.length > 0) {
    const loaded = await loadMissingStaffPermissions(c, {
      types: missing,
      user,
    });
    for (const [type, set] of loaded) sets[type] = set;
    await Promise.all(
      loaded.map(async ([type, set]) => await cached.write(type, set)),
    );
  }

  return {
    isAdmin: sets.admin?.staff ?? false,
    isModerator: sets.moderator?.staff ?? false,
  };
};

/**
 * {@link checkStaffPermission} for a user the caller resolved itself, such as a
 * socket that resolves its AdminCP session per message. Reads nothing from
 * `c.get("admin")` or `c.get("user")`.
 */
export const checkStaffPermissionOfUser = async (
  c: Context,
  user: StaffUser,
  { type, ...args }: PermissionsStaffArgs & { type: PermissionStaffType },
): Promise<boolean> => {
  const set = await resolveStaffPermissions(c, { type, user });

  return hasStaffPermission(set, args);
};

export const checkStaffPermission = async (
  c: Context,
  args: PermissionsStaffArgs & { type: PermissionStaffType },
): Promise<boolean> => {
  const user = args.type === "admin" ? c.get("admin")?.user : c.get("user");
  if (!user) return false;

  return await checkStaffPermissionOfUser(c, user, args);
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
