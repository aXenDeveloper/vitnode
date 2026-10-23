import type { Context } from "hono";

import { eq } from "drizzle-orm";

import {
  core_users_confirm_emails,
  core_users_forgot_password,
} from "@/database/users";

export const revokeAccountRecoveryTokens = async (
  c: Context,
  userId: number,
): Promise<void> => {
  const db = c.get("db");

  await Promise.all([
    db
      .delete(core_users_forgot_password)
      .where(eq(core_users_forgot_password.userId, userId)),
    db
      .delete(core_users_confirm_emails)
      .where(eq(core_users_confirm_emails.userId, userId)),
  ]);
};
