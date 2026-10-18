import type { Context } from "hono";

import { randomUUID } from "node:crypto";

import type {
  PermissionStaffType,
  ResolvedStaffPermissionSet,
} from "./permission-staff";

export const STAFF_PERMISSIONS_CACHE_TTL_SECONDS = 60;

const EPOCH_KEY = "staff-permissions:epoch";

export const STAFF_TYPES = ["admin", "moderator"] as const;

interface RequestStaffMemo {
  epoch?: Promise<string>;
  sets: Map<string, ResolvedStaffPermissionSet>;
}

// Per request, keyed by the Hono context so it dies with the request. Live
// (database) and cached answers are kept apart: a live check only reuses a live
// answer and a cached check only a cached one, so the memo never changes which
// source a check trusts. Cleared by every invalidation below, so a request that
// changes permissions and then checks them again sees the change.
const requestMemos = new WeakMap<Context, RequestStaffMemo>();

const memoOf = (c: Context): RequestStaffMemo => {
  let memo = requestMemos.get(c);
  if (!memo) {
    memo = { sets: new Map() };
    requestMemos.set(c, memo);
  }

  return memo;
};

const memoKey = (
  { type, userId }: { type: PermissionStaffType; userId: number },
  live: boolean,
): string => `${live ? "live" : "cached"}:${type}:${userId}`;

export const readRequestStaffPermissions = (
  c: Context,
  args: { type: PermissionStaffType; userId: number },
  { live = false }: { live?: boolean } = {},
): null | ResolvedStaffPermissionSet =>
  requestMemos.get(c)?.sets.get(memoKey(args, live)) ?? null;

export const rememberRequestStaffPermissions = (
  c: Context,
  args: { type: PermissionStaffType; userId: number },
  set: ResolvedStaffPermissionSet,
  { live }: { live: boolean },
): void => {
  memoOf(c).sets.set(memoKey(args, live), set);
};

const fetchEpoch = async (c: Context): Promise<string> =>
  (await c.get("cache").getSystem<string>(EPOCH_KEY)) ?? "0";

// The memo holds the promise, set before awaiting, so an invalidation that
// lands while the read is in flight clears it and the next read starts over.
const readEpoch = async (c: Context): Promise<string> => {
  const memo = memoOf(c);
  memo.epoch ??= fetchEpoch(c);

  return await memo.epoch;
};

const permissionsKey = (
  epoch: string,
  { type, userId }: { type: PermissionStaffType; userId: number },
): string => `staff-permissions:v3:${epoch}:${type}:${userId}`;

/** The cached resolution, or `null` on a miss, without Redis, or on error. */
export const readStaffPermissions = async (
  c: Context,
  args: { type: PermissionStaffType; userId: number },
): Promise<null | ResolvedStaffPermissionSet> =>
  await c
    .get("cache")
    .getSystem<ResolvedStaffPermissionSet>(
      permissionsKey(await readEpoch(c), args),
    );

const writeStaffPermissionsInEpoch = async (
  c: Context,
  epoch: string,
  args: { type: PermissionStaffType; userId: number },
  value: ResolvedStaffPermissionSet,
): Promise<void> => {
  await c
    .get("cache")
    .setSystem(
      permissionsKey(epoch, args),
      value,
      STAFF_PERMISSIONS_CACHE_TTL_SECONDS,
    );
};

/** Stores one resolution for {@link STAFF_PERMISSIONS_CACHE_TTL_SECONDS}. */
export const writeStaffPermissions = async (
  c: Context,
  args: { type: PermissionStaffType; userId: number },
  value: ResolvedStaffPermissionSet,
): Promise<void> => {
  await writeStaffPermissionsInEpoch(c, await readEpoch(c), args, value);
};

export interface CachedStaffPermissionsOfUser {
  sets: Record<PermissionStaffType, null | ResolvedStaffPermissionSet>;
  write: (
    type: PermissionStaffType,
    value: ResolvedStaffPermissionSet,
  ) => Promise<void>;
}

export const readStaffPermissionsOfUser = async (
  c: Context,
  userId: number,
): Promise<CachedStaffPermissionsOfUser> => {
  const epoch = await readEpoch(c);
  const [admin = null, moderator = null] = await c
    .get("cache")
    .getSystemMany<ResolvedStaffPermissionSet>([
      permissionsKey(epoch, { type: "admin", userId }),
      permissionsKey(epoch, { type: "moderator", userId }),
    ]);

  return {
    sets: { admin, moderator },
    write: async (type, value) => {
      await writeStaffPermissionsInEpoch(c, epoch, { type, userId }, value);
    },
  };
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
  const memo = memoOf(c);
  memo.epoch = undefined;
  memo.sets.clear();
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
  const memo = memoOf(c);
  for (const type of STAFF_TYPES) {
    memo.sets.delete(memoKey({ type, userId }, true));
    memo.sets.delete(memoKey({ type, userId }, false));
  }
  // Read fresh, not from the memo: deleting under a generation another request
  // has since moved past would leave the live entries in place.
  memo.epoch = fetchEpoch(c);
  const epoch = await memo.epoch;

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
