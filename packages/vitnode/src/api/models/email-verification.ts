import type { Context } from "hono";

import { and, eq, gt } from "drizzle-orm";
import crypto from "node:crypto";
import { createTranslator } from "use-intl";

import { core_users, core_users_confirm_emails } from "@/database/users";
import VerifyEmailTemplate from "@/emails/verify-email";
import { CONFIG } from "@/lib/config";

import { invalidateSessionCacheForUser } from "./session-revoke";

export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60 * 5;

export const EMAIL_NOT_VERIFIED = "email_not_verified";

export const isEmailVerificationRequired = (c: Context): boolean =>
  Boolean(c.get("core").email?.adapter);

export const mustVerifyEmail = (
  c: Context,
  user: { emailVerified: boolean },
): boolean => isEmailVerificationRequired(c) && !user.emailVerified;

export interface EmailVerificationRecipient {
  email: string;
  id: number;
  language: string;
  name: string;
}

export class EmailVerificationModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  generateToken(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async send(
    user: EmailVerificationRecipient,
    { respectCooldown = false }: { respectCooldown?: boolean } = {},
  ): Promise<boolean> {
    const db = this.c.get("db");

    if (respectCooldown) {
      const issued = await db
        .select({ createdAt: core_users_confirm_emails.createdAt })
        .from(core_users_confirm_emails)
        .where(eq(core_users_confirm_emails.userId, user.id));
      const cooldownStart = Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;

      if (issued.some(row => row.createdAt.getTime() > cooldownStart)) {
        return false;
      }
    }

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await db.transaction(async tx => {
      await tx
        .delete(core_users_confirm_emails)
        .where(eq(core_users_confirm_emails.userId, user.id));
      await tx.insert(core_users_confirm_emails).values({
        userId: user.id,
        token: this.hashToken(token),
        expiresAt,
        ipAddress: this.c.get("ipAddress"),
      });
    });

    const verifyUrl = new URL(
      `login/verify-email?token=${encodeURIComponent(token)}`,
      CONFIG.web.href,
    );

    await this.c.get("email").send({
      user: {
        id: user.id,
        email: user.email,
        language: user.language,
        name: user.name,
      },
      content: props =>
        VerifyEmailTemplate({
          ...props,
          verifyUrl: verifyUrl.href,
          expiryDate: expiresAt,
          userIpAddress: this.c.get("ipAddress"),
        }),
      subject: ({ i18n }) =>
        createTranslator(i18n)("core.auth.verify_email.email.subject"),
    });

    return true;
  }

  async verify(token: string): Promise<null | { email: string; id: number }> {
    const db = this.c.get("db");

    const [spent] = await db
      .delete(core_users_confirm_emails)
      .where(
        and(
          eq(core_users_confirm_emails.token, this.hashToken(token)),
          gt(core_users_confirm_emails.expiresAt, new Date()),
        ),
      )
      .returning({ userId: core_users_confirm_emails.userId });

    if (!spent) return null;

    const [user] = await db
      .update(core_users)
      .set({ emailVerified: true })
      .where(eq(core_users.id, spent.userId))
      .returning({ email: core_users.email, id: core_users.id });

    await db
      .delete(core_users_confirm_emails)
      .where(eq(core_users_confirm_emails.userId, spent.userId));

    if (!user) return null;

    await invalidateSessionCacheForUser(this.c, user.id);
    await this.c.get("events").emit("user.email.verified", {
      email: user.email,
      userId: user.id,
    });

    return user;
  }
}
