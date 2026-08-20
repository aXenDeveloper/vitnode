import type { Context } from "hono";

import { randomUUID } from "node:crypto";

import type {
  PermissionStaffType,
  StaffPermissionSet,
} from "./permission-staff";

/**
 * How long one resolved permission set is trusted.
 *
 * The same 60 seconds the [session cache](../models/session-cache.ts) uses, and
 * for the same reason: it is a ceiling on how stale a permission check can be if
 * something changed the answer without going through one of the invalidation
 * points below. Every route that *does* change the answer expires the cache
 * itself, so the TTL is a backstop rather than the mechanism.
 */
export const STAFF_PERMISSIONS_CACHE_TTL_SECONDS = 60;

/**
 * The generation stamp every permission key is built from.
 *
 * Lives in the framework system namespace and is written with **no TTL** - it is
 * the thing that has to outlive the entries it names.
 */
const EPOCH_KEY = "staff-permissions:epoch";

const STAFF_TYPES = ["admin", "moderator"] as const;

/**
 * Reads the current generation, or the one every deployment starts on.
 *
 * A miss is not an error: it means nothing has invalidated the cache yet - or
 * Redis is not configured, in which case nothing is cached either and the key
 * this builds is never read from anything.
 */
const readEpoch = async (c: Context): Promise<string> =>
  (await c.get("cache").getSystem<string>(EPOCH_KEY)) ?? "0";

/**
 * Where one user's resolved permission set of one kind lives.
 *
 * In the **system** namespace rather than the per-plugin one, because the read
 * and the write can happen under different plugins: a moderator permission check
 * runs inside whichever plugin's route asked for it, while the AdminCP routes
 * that invalidate it are core's. A plugin-namespaced key would let a plugin's
 * cached copy survive the change that was supposed to expire it.
 */
const permissionsKey = (
  epoch: string,
  { type, userId }: { type: PermissionStaffType; userId: number },
): string => `staff-permissions:${epoch}:${type}:${userId}`;

/** The cached resolution, or `null` on a miss, without Redis, or on error. */
export const readStaffPermissions = async (
  c: Context,
  args: { type: PermissionStaffType; userId: number },
): Promise<null | StaffPermissionSet> =>
  await c
    .get("cache")
    .getSystem<StaffPermissionSet>(permissionsKey(await readEpoch(c), args));

/** Stores one resolution for {@link STAFF_PERMISSIONS_CACHE_TTL_SECONDS}. */
export const writeStaffPermissions = async (
  c: Context,
  args: { type: PermissionStaffType; userId: number },
  value: StaffPermissionSet,
): Promise<void> => {
  await c
    .get("cache")
    .setSystem(
      permissionsKey(await readEpoch(c), args),
      value,
      STAFF_PERMISSIONS_CACHE_TTL_SECONDS,
    );
};

/**
 * Expires **every** cached permission set, for every user, at once.
 *
 * By moving the generation rather than deleting keys, because the mutations that
 * need this are the role-shaped ones - a role gaining `root`, a role being
 * deleted and its members reassigned - and those change the answer for every
 * member of that role. Enumerating them would be a query plus one delete per
 * user; moving the stamp is a single write, and the entries it orphans fall out
 * on their own TTL.
 *
 * The new stamp is a random id rather than a timestamp. Two app instances with
 * skewed clocks could otherwise write a *lower* stamp than the one already
 * stored, pointing new reads back at a generation whose stale entries are still
 * alive.
 */
export const invalidateAllStaffPermissions = async (
  c: Context,
): Promise<void> => {
  await c.get("cache").setSystem(EPOCH_KEY, randomUUID());
};

/**
 * Expires one user's cached permission sets - both kinds, since a role
 * reassignment moves admin and moderator permissions together.
 *
 * Used where the mutation names a single user, so the rest of the staff keep
 * their warm entries.
 */
export const invalidateStaffPermissionsForUser = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const epoch = await readEpoch(c);

  await c
    .get("cache")
    .deleteSystem(
      STAFF_TYPES.map(type => permissionsKey(epoch, { type, userId })),
    );
};

/**
 * Expires whatever one staff entry governs.
 *
 * A staff entry hangs off *either* a user or a role, and the two are worth
 * different amounts of cache: a user entry affects exactly that person, while a
 * role entry affects everyone who holds the role - a set this route has no cheap
 * way to enumerate. So one gets a targeted delete and the other moves the
 * generation.
 */
export const invalidateStaffEntry = async (
  c: Context,
  entry: { roleId?: null | number; userId?: null | number },
): Promise<void> => {
  if (entry.userId != null) {
    await invalidateStaffPermissionsForUser(c, entry.userId);

    return;
  }

  await invalidateAllStaffPermissions(c);
};
