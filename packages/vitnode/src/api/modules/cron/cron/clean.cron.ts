import { lt } from "drizzle-orm";
import { buildCron } from "@/api/lib/cron";
import { core_admin_sessions } from "@/database/admins";
import { core_sessions } from "@/database/sessions";
import { core_users_forgot_password } from "@/database/users";

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

      // Delete expired forgot password tokens
      await tx
        .delete(core_users_forgot_password)
        .where(lt(core_users_forgot_password.expiresAt, new Date()));

      // // Delete expired email confirmation tokens
      // await tx
      //   .delete(core_users_confirm_emails)
      //   .where(lt(core_users_confirm_emails.expiresAt, new Date()));
    });
  },
});
