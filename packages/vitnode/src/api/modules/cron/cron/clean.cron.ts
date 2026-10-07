import type { SQL } from "drizzle-orm";

import { eq, lt, notExists, sql } from "drizzle-orm";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { buildCron } from "@/api/lib/cron";
import { core_admin_sessions } from "@/database/admins";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import {
  core_users_confirm_emails,
  core_users_forgot_password,
} from "@/database/users";

export const isOrphanedDevice = (
  db: Pick<EnvVitNode["Variables"]["db"], "select">,
): SQL => {
  const hasNoPublicSessions = notExists(
    db
      .select({ one: sql`1` })
      .from(core_sessions)
      .where(eq(core_sessions.deviceId, core_sessions_known_devices.id)),
  );
  const hasNoAdminSessions = notExists(
    db
      .select({ one: sql`1` })
      .from(core_admin_sessions)
      .where(eq(core_admin_sessions.deviceId, core_sessions_known_devices.id)),
  );

  return sql`${hasNoPublicSessions} and ${hasNoAdminSessions}`;
};

export const cleanCron = buildCron({
  name: "clean",
  description: "Clean up expired sessions and tokens",
  // Run every 1 hour
  schedule: "0 * * * *",
  handler: async c => {
    await c.get("db").transaction(async tx => {
      // Delete expired sessions
      await tx
        .delete(core_sessions)
        .where(lt(core_sessions.expiresAt, new Date()));
      await tx
        .delete(core_admin_sessions)
        .where(lt(core_admin_sessions.expiresAt, new Date()));

      await tx.delete(core_sessions_known_devices).where(isOrphanedDevice(tx));

      // Delete expired forgot password tokens
      await tx
        .delete(core_users_forgot_password)
        .where(lt(core_users_forgot_password.expiresAt, new Date()));

      // Delete expired email confirmation tokens
      await tx
        .delete(core_users_confirm_emails)
        .where(lt(core_users_confirm_emails.expiresAt, new Date()));
    });
  },
});
