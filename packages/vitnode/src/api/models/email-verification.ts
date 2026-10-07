import type { Context } from "hono";

import { and, eq, gt } from "drizzle-orm";
import crypto from "node:crypto";
import { createTranslator } from "use-intl";

import { core_users, core_users_confirm_emails } from "@/database/users";
import VerifyEmailTemplate from "@/emails/verify-email";
import { CONFIG } from "@/lib/config";

import { invalidateSessionCacheForUser } from "./session-revoke";

/** How long a confirmation link stays usable. */
export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

/** How long a resend request is ignored after a link was issued. */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60 * 5;

/** The error body every refused sign-in of an unconfirmed account carries. */
export const EMAIL_NOT_VERIFIED = "email_not_verified";

/**
 * Whether this install asks members to confirm their address.
 *
 * Only an install that can send email can ask - without an adapter sign-up
 * marks every account as confirmed, so there is nothing left to enforce.
 */
export const isEmailVerificationRequired = (c: Context): boolean =>
  Boolean(c.get("core").email?.adapter);

/** `true` when this account must confirm its address before it signs in. */
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

  /**
   * Replaces the account's confirmation link with a fresh one and emails it.
   *
   * Only the digest is stored - the raw token travels in the email and nowhere
   * else, exactly like a password reset link. With `respectCooldown` a link
   * issued in the last five minutes is left alone and nothing is sent, which is
   * what keeps the public resend endpoint from becoming a mail cannon.
   *
   * @returns whether an email was sent.
   */
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

  /**
   * Spends a confirmation link and marks its account as confirmed.
   *
   * The row is deleted and read back in one statement, so two clicks racing
   * each other cannot both succeed - the link is single-use by construction,
   * not by a check that could be interleaved.
   *
   * @returns the confirmed account, or `null` for a wrong, spent or expired link.
   */
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

    // Any link still out there for this account has nothing left to confirm.
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
