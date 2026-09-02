import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { core_admin_sessions } from "@/database/admins";
import { core_sessions } from "@/database/sessions";

import { adminSessionCacheKey, sessionCacheKey } from "./session-cache";

/**
 * The cache keys holding one user's resolved sessions, read off their rows.
 *
 * The cache is keyed by token, so there is no way back from a user id to those
 * keys other than looking the sessions up first. Both callers below need exactly
 * that, for opposite reasons - one is about to delete the rows, the other wants
 * them re-read - so the lookup lives here once.
 */
const sessionCacheKeysForUser = async (
  c: Context,
  userId: number,
): Promise<string[]> => {
  const db = c.get("db");

  const [sessions, adminSessions] = await Promise.all([
    db
      .select({ token: core_sessions.token, deviceId: core_sessions.deviceId })
      .from(core_sessions)
      .where(eq(core_sessions.userId, userId)),
    db
      .select({
        token: core_admin_sessions.token,
        deviceId: core_admin_sessions.deviceId,
      })
      .from(core_admin_sessions)
      .where(eq(core_admin_sessions.userId, userId)),
  ]);

  return [
    ...sessions.map(({ token, deviceId }) => sessionCacheKey(token, deviceId)),
    ...adminSessions.map(({ token, deviceId }) =>
      adminSessionCacheKey(token, deviceId),
    ),
  ];
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
  const keys = await sessionCacheKeysForUser(c, userId);

  if (keys.length > 0) {
    await c.get("cache").deleteSystem(keys);
  }
};

/**
 * Signs one user out everywhere - every device, every browser, the AdminCP
 * included.
 *
 * Called when a credential changes hands. A password reset that leaves the old
 * sessions alive only locks the attacker out of *signing in again*: whatever
 * they already hold keeps working for the ninety days the session cookie lasts,
 * which is the opposite of what somebody resetting a password after a breach
 * believes they just did.
 *
 * The rows are read before they are deleted because the session cache is keyed
 * by token, and there is no other way back from a user id to the keys holding
 * them. Its TTL is only a minute, so this is about closing that minute rather
 * than about correctness over time.
 */
export const revokeAllSessionsForUser = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const db = c.get("db");
  const keys = await sessionCacheKeysForUser(c, userId);

  await Promise.all([
    db.delete(core_sessions).where(eq(core_sessions.userId, userId)),
    db
      .delete(core_admin_sessions)
      .where(eq(core_admin_sessions.userId, userId)),
  ]);

  if (keys.length > 0) {
    await c.get("cache").deleteSystem(keys);
  }
};
