import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import crypto from "node:crypto";
import { createTranslator } from "use-intl";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { hashSsoSecret, timingSafeEqualText } from "@/api/lib/sso-protocol";
import SsoEmailCodeTemplate from "@/emails/sso-email-code";
import { normalizeEmailAddress } from "@/lib/email-canonical";

import type { SSOCallbackOutcome } from "./sso";

import { SSOModel } from "./sso";
import { SsoConnectionModel } from "./sso-connection";

export const SSO_EMAIL_CODE_TTL_MS = 10 * 60_000;
export const SSO_EMAIL_CODE_MAX_ATTEMPTS = 5;
export const SSO_EMAIL_CODE_MAX_SENDS = 5;
export const SSO_EMAIL_CODE_COOLDOWN_MS = 30_000;

export type SsoEmailCompletionError =
  | "code_expired"
  | "invalid_code"
  | "invalid_pending"
  | "too_many_codes";

const failure = (status: 400 | 429, error: SsoEmailCompletionError) =>
  new HTTPException(status, { message: error });

const codeHashOf = (tokenHash: string, code: string) =>
  hashSsoSecret(`${tokenHash}:${code}`);

/**
 * The last step for a provider identity that brought no trustworthy email:
 * the visitor names an address, proves it with an emailed six-digit code in
 * the same browser, and only then is an account created - or the existing
 * account's password asked for before linking. Server-only.
 */
export class SsoEmailCompletionModel {
  constructor(c: Context<EnvVitNode>) {
    this.c = c;
    this.sso = new SSOModel(c);
  }

  private readonly c: Context<EnvVitNode>;
  private readonly sso: SSOModel;

  private pendingTokenHash(): string {
    const token = this.sso.pendingToken;
    if (!token) throw failure(400, "invalid_pending");

    return hashSsoSecret(token);
  }

  /**
   * Emails a fresh code to `email` for this browser's pending identity. Says
   * nothing about whether the address has an account.
   *
   * @throws `HTTPException(400)` without a live pending identity for
   * `providerId`, `429` past five codes or within 30 seconds of the last one.
   */
  async sendCode({
    email,
    providerId,
  }: {
    email: string;
    providerId: string;
  }): Promise<void> {
    const provider = this.c
      .get("core")
      .authorization.ssoAdapters.find(one => one.id === providerId);
    const tokenHash = this.pendingTokenHash();
    const now = new Date();
    const pending = await this.sso.flowStore.findPending({ now, tokenHash });
    if (!(pending && provider && pending.providerId === providerId)) {
      throw failure(400, "invalid_pending");
    }

    const address = normalizeEmailAddress(email);
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const stored = await this.sso.flowStore.setPendingCode({
      codeExpiresAt: new Date(now.getTime() + SSO_EMAIL_CODE_TTL_MS),
      codeHash: codeHashOf(tokenHash, code),
      cooldownMs: SSO_EMAIL_CODE_COOLDOWN_MS,
      email: address,
      maxSends: SSO_EMAIL_CODE_MAX_SENDS,
      now,
      tokenHash,
    });
    if (!stored) throw failure(429, "too_many_codes");

    await this.c.get("email").send({
      content: props =>
        SsoEmailCodeTemplate({
          ...props,
          code,
          expiryMinutes: SSO_EMAIL_CODE_TTL_MS / 60_000,
          provider: provider.name,
          userIpAddress: this.c.get("ipAddress"),
        }),
      locale: this.c.get("i18n").resolveLocale(),
      subject: ({ i18n }) =>
        createTranslator(i18n)("core.auth.sso_email_code.email.subject", {
          code,
        }),
      to: address,
    });
  }

  /**
   * Checks the code and, when it matches, consumes the pending identity once:
   * signs in the member it is linked to by now, signs up a new member with the
   * confirmed address, or returns the link offer for the account that already
   * owns it.
   *
   * @throws `HTTPException(400)` for a wrong, expired or spent code, or with
   * no pending identity.
   */
  async verifyCode({
    code,
    providerId,
  }: {
    code: string;
    providerId: string;
  }): Promise<
    Extract<SSOCallbackOutcome, { kind: "link_required" | "signed_in" }>
  > {
    const tokenHash = this.pendingTokenHash();
    const now = new Date();
    const counted = await this.sso.flowStore.countCodeAttempt({
      maxAttempts: SSO_EMAIL_CODE_MAX_ATTEMPTS,
      now,
      tokenHash,
    });
    if (!counted?.codeHash || !counted.email) {
      throw failure(400, "code_expired");
    }
    if (counted.providerId !== providerId) {
      throw failure(400, "invalid_pending");
    }
    if (!timingSafeEqualText(counted.codeHash, codeHashOf(tokenHash, code))) {
      throw failure(400, "invalid_code");
    }

    const pending = await this.sso.flowStore.consumePending({
      now,
      tokenHash,
    });
    this.sso.clearPendingCookie();
    if (!pending?.email) throw failure(400, "code_expired");

    const provider = this.c
      .get("core")
      .authorization.ssoAdapters.find(one => one.id === providerId);
    if (!provider) throw new HTTPException(404);

    const identity = {
      email: null,
      id: pending.providerAccountId,
      profile: pending.profile ?? {
        avatarUrl: null,
        firstName: null,
        lastName: null,
      },
      username: pending.providerUsername,
    };

    const linked = await this.sso.findLinkedUser(providerId, identity.id);
    if (linked) {
      await new SsoConnectionModel(this.c).afterSignIn({
        identity,
        providerId,
        userId: linked.userId,
      });

      return { kind: "signed_in", userId: linked.userId };
    }

    return await this.sso.signUpOrOfferLink({
      email: pending.email,
      identity,
      provider,
      providerEmail: null,
    });
  }
}
