import type { Context } from "hono";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
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

/**
 * Every role id a user has - the primary `roleId` plus secondary roles - with
 * duplicates removed. Reads the database on each call.
 */
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

/**
 * The effective staff permission set of a user for one staff type, from the
 * staff permission cache or, on a miss, from the database (then cached). Root
 * roles and unrestricted entries resolve to `root: true`.
 */
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

const USERS_PER_PERMISSION_BATCH = 500;

/**
 * The effective staff permission sets of many users, read from the database in
 * three queries per 500 users rather than one round trip per user. Resolves
 * exactly like {@link resolveStaffPermissions} - root roles, unrestricted
 * entries, merged role and user grants, scoped dependencies - but skips the
 * cache, so a grant revoked a moment ago no longer counts. For background work
 * that checks one permission for a list of recipients. Server-only.
 *
 * Users that do not exist are missing from the map.
 */
export const loadStaffPermissionsOfUsers = async (
  c: Context,
  { type, userIds }: { type: PermissionStaffType; userIds: readonly number[] },
): Promise<Map<number, ResolvedStaffPermissionSet>> => {
  const db = c.get("db");
  const table = tableByType[type];
  const result = new Map<number, ResolvedStaffPermissionSet>();
  const ids = [...new Set(userIds)];

  for (let start = 0; start < ids.length; start += USERS_PER_PERMISSION_BATCH) {
    const chunk = ids.slice(start, start + USERS_PER_PERMISSION_BATCH);
    const rows = await db
      .select({
        roleId: core_users.roleId,
        secondaryRoleId: core_users_secondary_roles.roleId,
        userId: core_users.id,
      })
      .from(core_users)
      .leftJoin(
        core_users_secondary_roles,
        eq(core_users_secondary_roles.userId, core_users.id),
      )
      .where(inArray(core_users.id, chunk));

    const rolesOf = new Map<number, Set<number>>();
    for (const row of rows) {
      const roles = rolesOf.get(row.userId) ?? new Set([row.roleId]);
      if (typeof row.secondaryRoleId === "number") {
        roles.add(row.secondaryRoleId);
      }
      rolesOf.set(row.userId, roles);
    }
    if (rolesOf.size === 0) continue;

    const roleIds = [
      ...new Set([...rolesOf.values()].flatMap(roles => [...roles])),
    ];
    const [rootRoles, entries] = await Promise.all([
      db
        .select({ id: core_roles.id })
        .from(core_roles)
        .where(and(inArray(core_roles.id, roleIds), eq(core_roles.root, true))),
      db
        .select({
          permissions: table.permissions,
          roleId: table.roleId,
          unrestricted: table.unrestricted,
          userId: table.userId,
        })
        .from(table)
        .where(
          or(
            inArray(table.userId, [...rolesOf.keys()]),
            inArray(table.roleId, roleIds),
          ),
        ),
    ]);
    const root = new Set(rootRoles.map(row => row.id));

    for (const [userId, roles] of rolesOf) {
      result.set(
        userId,
        [...roles].some(id => root.has(id))
          ? rootStaffPermissions()
          : toStaffPermissionSet(
              c,
              entries.filter(
                entry =>
                  entry.userId === userId ||
                  (entry.roleId !== null && roles.has(entry.roleId)),
              ),
            ),
      );
    }
  }

  return result;
};

/**
 * Users who may hold a staff permission: everyone with an entry - their own or
 * one of their roles' - that is unrestricted or lists the permission, plus the
 * members of root roles. A superset, since a scoped grant can still miss the
 * resource in question: check each candidate with
 * {@link loadStaffPermissionsOfUsers}. Lowest ids first, at most `limit`.
 * Server-only.
 */
export const findStaffPermissionCandidates = async (
  c: Context,
  {
    limit,
    module,
    permission,
    plugin,
    type,
  }: Omit<PermissionsStaffArgs, "scope"> & {
    limit: number;
    type: PermissionStaffType;
  },
): Promise<number[]> => {
  const db = c.get("db");
  const table = tableByType[type];
  const [entries, rootRoles] = await Promise.all([
    db
      .select({ roleId: table.roleId, userId: table.userId })
      .from(table)
      .where(
        or(
          eq(table.unrestricted, true),
          sql`${table.permissions} @> ${JSON.stringify([{ module, permission, plugin }])}::jsonb`,
        ),
      ),
    db
      .select({ id: core_roles.id })
      .from(core_roles)
      .where(eq(core_roles.root, true)),
  ]);

  const userIds = [...new Set(entries.flatMap(entry => entry.userId ?? []))];
  const roleIds = [
    ...new Set([
      ...entries.flatMap(entry => entry.roleId ?? []),
      ...rootRoles.map(row => row.id),
    ]),
  ];
  if (userIds.length === 0 && roleIds.length === 0) return [];

  const rows = await db
    .selectDistinct({ id: core_users.id })
    .from(core_users)
    .leftJoin(
      core_users_secondary_roles,
      eq(core_users_secondary_roles.userId, core_users.id),
    )
    .where(
      or(
        userIds.length > 0 ? inArray(core_users.id, userIds) : undefined,
        roleIds.length > 0 ? inArray(core_users.roleId, roleIds) : undefined,
        roleIds.length > 0
          ? inArray(core_users_secondary_roles.roleId, roleIds)
          : undefined,
      ),
    )
    .orderBy(asc(core_users.id))
    .limit(limit);

  return rows.map(row => row.id);
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

/** {@link checkStaffPermission} for an explicit user instead of the request's. */
export const checkStaffPermissionOfUser = async (
  c: Context,
  user: StaffUser,
  { type, ...args }: StaffPermissionCheck & { type: PermissionStaffType },
): Promise<boolean> => {
  const set = await resolveStaffPermissions(c, { type, user });

  return hasStaffPermission(set, args);
};

/**
 * Whether the current request's staff member holds a permission. `type:
 * "admin"` checks the AdminCP session (`c.get("admin")`), `"moderator"` the
 * signed-in user. Returns `false` when there is no such user.
 *
 * Pass `resource` to check a scoped grant for one resource. Without it, a
 * grant scoped to selected resources does not count; one scoped to all
 * resources of its family does.
 */
export const checkStaffPermission = async (
  c: Context,
  args: StaffPermissionCheck & { type: PermissionStaffType },
): Promise<boolean> => {
  const user = args.type === "admin" ? c.get("admin")?.user : c.get("user");
  if (!user) return false;

  return await checkStaffPermissionOfUser(c, user, args);
};

/**
 * {@link checkStaffPermission}, throwing instead of returning `false`.
 *
 * @throws HTTPException 403 when the permission is missing.
 *
 * @example
 * ```ts
 * await assertStaffPermission(c, {
 *   type: "admin",
 *   plugin: "@vitnode/blog",
 *   module: "posts",
 *   permission: "can_delete",
 * });
 * ```
 */
export const assertStaffPermission = async (
  c: Context,
  args: StaffPermissionCheck & { type: PermissionStaffType },
): Promise<void> => {
  const allowed = await checkStaffPermission(c, args);
  if (!allowed) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
};
