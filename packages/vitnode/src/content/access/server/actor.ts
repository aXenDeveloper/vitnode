import type { Context } from "hono";

import { eq, inArray } from "drizzle-orm";

import type { ContentAccessActor } from "../policy";

import {
  core_users,
  core_users_secondary_roles,
} from "../../../database/users";

const GUEST: ContentAccessActor = { kind: "guest" };

const actors = new WeakMap<Context, Promise<ContentAccessActor>>();

/**
 * Members' current roles, read from the database - never from
 * the session cache or anything a client sent - so a role removed a moment ago
 * stops counting on the next request. A user id that no longer exists is a
 * guest.
 */
export const loadContentAccessActors = async (
  c: Context,
  userIds: readonly number[],
): Promise<Map<number, ContentAccessActor>> => {
  const ids = [...new Set(userIds)].filter(id => Number.isSafeInteger(id));
  const actorsById = new Map<number, ContentAccessActor>();
  if (ids.length === 0) return actorsById;

  const db = c.get("db");
  const rows = await db
    .select({
      id: core_users.id,
      roleId: core_users.roleId,
      secondaryRoleId: core_users_secondary_roles.roleId,
    })
    .from(core_users)
    .leftJoin(
      core_users_secondary_roles,
      eq(core_users_secondary_roles.userId, core_users.id),
    )
    .where(inArray(core_users.id, ids));

  const roles = new Map<number, Set<number>>();
  for (const row of rows) {
    const set = roles.get(row.id) ?? new Set([row.roleId]);
    if (typeof row.secondaryRoleId === "number") set.add(row.secondaryRoleId);
    roles.set(row.id, set);
  }

  for (const [userId, set] of roles) {
    const roleIds = [...set].sort((a, b) => a - b);
    actorsById.set(userId, {
      kind: "member",
      roleIds,
      system: false,
      userId,
    });
  }

  return actorsById;
};

/**
 * Who the current request is for, as access rules see them: a guest, or a
 * member with their primary and secondary roles. Root roles follow the rules
 * like any other role. Read once per request. Server-only.
 */
export const resolveContentAccessActor = async (
  c: Context,
): Promise<ContentAccessActor> => {
  const remembered = actors.get(c);
  if (remembered) return await remembered;

  const user = c.get("user") as null | undefined | { id: number };
  const load = async (): Promise<ContentAccessActor> => {
    if (!user) return GUEST;

    return (await loadContentAccessActors(c, [user.id])).get(user.id) ?? GUEST;
  };
  const promise = load();
  actors.set(c, promise);

  return await promise;
};

/** Forgets the memoised actor, after a write changed the user's roles. */
export const forgetContentAccessActor = (c: Context): void => {
  actors.delete(c);
};

export const CONTENT_ACCESS_GUEST: ContentAccessActor = GUEST;
