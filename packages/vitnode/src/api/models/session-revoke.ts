import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { core_admin_sessions } from "@/database/admins";
import { core_sessions } from "@/database/sessions";

import { adminSessionCacheKey, sessionCacheKey } from "./session-cache";

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

  await Promise.all([
    db.delete(core_sessions).where(eq(core_sessions.userId, userId)),
    db
      .delete(core_admin_sessions)
      .where(eq(core_admin_sessions.userId, userId)),
  ]);

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
