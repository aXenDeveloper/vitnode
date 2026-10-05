import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import { core_admin_sessions } from "@/database/admins";
import { core_sessions } from "@/database/sessions";

import { adminSessionCacheKey, sessionCacheKey } from "./session-cache";

export interface SessionScope {
  deviceId?: number;
  userId: number;
}

interface SessionRow {
  deviceId: number;
  token: string;
}

const userSessionsIn = ({ deviceId, userId }: SessionScope) =>
  and(
    eq(core_sessions.userId, userId),
    deviceId === undefined ? undefined : eq(core_sessions.deviceId, deviceId),
  );

const adminSessionsIn = ({ deviceId, userId }: SessionScope) =>
  and(
    eq(core_admin_sessions.userId, userId),
    deviceId === undefined
      ? undefined
      : eq(core_admin_sessions.deviceId, deviceId),
  );

const userSessionColumns = {
  deviceId: core_sessions.deviceId,
  token: core_sessions.token,
};

const adminSessionColumns = {
  deviceId: core_admin_sessions.deviceId,
  token: core_admin_sessions.token,
};

const deleteSessionCacheKeys = async (
  c: Context,
  {
    adminSessions,
    sessions,
  }: { adminSessions: SessionRow[]; sessions: SessionRow[] },
): Promise<void> => {
  const keys = [
    ...sessions.map(({ token, deviceId }) => sessionCacheKey(token, deviceId)),
    ...adminSessions.map(({ token, deviceId }) =>
      adminSessionCacheKey(token, deviceId),
    ),
  ];

  if (keys.length > 0) {
    await c.get("cache").deleteSystem(keys);
  }
};

/**
 * Drops one user's cached session rows, leaving the sessions themselves alone.
 *
 * Call this whenever something the *cached user object* carries has changed -
 * `roleId`, above all. `resolveStaffPermissions` is handed `c.get("user")`,
 * which is that cached object, and reads the primary role straight off it:
 *
 * ```ts
 * const roleIds = await getUserRoleIds(c, user);   // [user.roleId, ...secondary]
 * ```
 *
 * Expiring the permission cache alone is therefore not enough. Recomputing from
 * a stale `roleId` produces the same answer it just threw away, so somebody
 * demoted out of an administrator role kept its powers until the session cache
 * happened to expire - a minute in which the demotion had visibly been applied
 * and had not taken effect.
 */
export const invalidateSessionCacheForUser = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const db = c.get("db");
  const scope = { userId };

  const [sessions, adminSessions] = await Promise.all([
    db
      .select(userSessionColumns)
      .from(core_sessions)
      .where(userSessionsIn(scope)),
    db
      .select(adminSessionColumns)
      .from(core_admin_sessions)
      .where(adminSessionsIn(scope)),
  ]);

  await deleteSessionCacheKeys(c, { adminSessions, sessions });
};

export const revokeSessions = async (
  c: Context,
  scope: SessionScope,
): Promise<void> => {
  const db = c.get("db");

  const [sessions, adminSessions] = await Promise.all([
    db
      .delete(core_sessions)
      .where(userSessionsIn(scope))
      .returning(userSessionColumns),
    db
      .delete(core_admin_sessions)
      .where(adminSessionsIn(scope))
      .returning(adminSessionColumns),
  ]);

  await deleteSessionCacheKeys(c, { adminSessions, sessions });
};
