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
import type { StaffPermissionCheck } from "./staff-permission";

import {
  applyScopedStaffDependencies,
  hasStaffPermission,
  mergeStaffPermissionGrants,
} from "./staff-permission";
import {
  readRequestStaffPermissions,
  readStaffPermissions,
  readStaffPermissionsOfUser,
  rememberRequestStaffPermissions,
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
  c: Context,
  entries: Awaited<ReturnType<typeof findStaffEntries>>,
): ResolvedStaffPermissionSet => {
  if (entries.some(entry => entry.unrestricted)) {
    return rootStaffPermissions();
  }

  const merged: PermissionsStaffArgs[] = mergeStaffPermissionGrants(
    entries.flatMap(entry => entry.permissions ?? []),
  );
  const catalog = c.get("core")?.permissionStaff;
  const permissions = catalog
    ? applyScopedStaffDependencies(merged, catalog)
    : merged;

  return { root: false, permissions, staff: entries.length > 0 };
};

const loadStaffPermissionsForRoles = async (
  c: Context,
  args: { roleIds: number[]; type: PermissionStaffType; userId: number },
): Promise<ResolvedStaffPermissionSet> => {
  // Both at once: the entries query is wasted for a root user, but a root user
  // is the rare case and the two round trips don't queue behind each other.
  const [root, entries] = await Promise.all([
    hasRootRole(c, args.roleIds),
    findStaffEntries(c, args),
  ]);

  return root ? rootStaffPermissions() : toStaffPermissionSet(c, entries);
};

const loadStaffPermissions = async (
  c: Context,
  { type, user }: { type: PermissionStaffType; user: StaffUser },
): Promise<ResolvedStaffPermissionSet> =>
  await loadStaffPermissionsForRoles(c, {
    roleIds: await getUserRoleIds(c, user),
    type,
    userId: user.id,
  });

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
): Promise<ResolvedStaffPermissionSet> => {
  const args = { type, userId: user.id };
  const remembered = readRequestStaffPermissions(c, args);
  if (remembered) return remembered;

  const resolved =
    (await readStaffPermissions(c, args)) ??
    (await loadAndCacheStaffPermissions(c, { type, user }));
  rememberRequestStaffPermissions(c, args, resolved, { live: false });

  return resolved;
};

/** The user's role ids - primary and secondary - in one query, or `null`. */
const findStaffUserRoleIds = async (
  c: Context,
  userId: number,
): Promise<null | number[]> => {
  const rows = await c
    .get("db")
    .select({
      roleId: core_users.roleId,
      secondaryRoleId: core_users_secondary_roles.roleId,
    })
    .from(core_users)
    .leftJoin(
      core_users_secondary_roles,
      eq(core_users_secondary_roles.userId, core_users.id),
    )
    .where(eq(core_users.id, userId));

  const [first] = rows;
  if (!first) return null;

  const roleIds = new Set([first.roleId]);
  for (const { secondaryRoleId } of rows) {
    if (typeof secondaryRoleId === "number") roleIds.add(secondaryRoleId);
  }

  return [...roleIds];
};

/**
 * Whether the user is staff of `type`. With `live`, reads the database and
 * ignores the cross-request cache - the session checks use it so a revoked
 * admin loses access at once. Either way the answer is remembered for the rest
 * of the request, so a second check from the same source does not repeat it.
 */
export const isStaff = async (
  c: Context,
  {
    live = false,
    type,
    userId,
  }: { live?: boolean; type: PermissionStaffType; userId: number },
): Promise<boolean> => {
  const args = { type, userId };
  const remembered = readRequestStaffPermissions(c, args, { live });
  if (remembered) return remembered.staff;

  if (!live) {
    const cached = await readStaffPermissions(c, args);
    if (cached) {
      rememberRequestStaffPermissions(c, args, cached, { live: false });

      return cached.staff;
    }
  }

  const roleIds = await findStaffUserRoleIds(c, userId);
  if (!roleIds) return false;

  const resolved = await loadStaffPermissionsForRoles(c, {
    roleIds,
    type,
    userId,
  });
  if (!live) await writeStaffPermissions(c, args, resolved);
  rememberRequestStaffPermissions(c, args, resolved, { live: true });

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
    root ? rootStaffPermissions() : toStaffPermissionSet(c, entries),
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

export const checkStaffPermissionOfUser = async (
  c: Context,
  user: StaffUser,
  { type, ...args }: StaffPermissionCheck & { type: PermissionStaffType },
): Promise<boolean> => {
  const set = await resolveStaffPermissions(c, { type, user });

  return hasStaffPermission(set, args);
};

export const checkStaffPermission = async (
  c: Context,
  args: StaffPermissionCheck & { type: PermissionStaffType },
): Promise<boolean> => {
  const user = args.type === "admin" ? c.get("admin")?.user : c.get("user");
  if (!user) return false;

  return await checkStaffPermissionOfUser(c, user, args);
};

export const assertStaffPermission = async (
  c: Context,
  args: StaffPermissionCheck & { type: PermissionStaffType },
): Promise<void> => {
  const allowed = await checkStaffPermission(c, args);
  if (!allowed) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
};
