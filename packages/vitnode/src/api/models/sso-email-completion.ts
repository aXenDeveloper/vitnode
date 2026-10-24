import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { createTranslator } from "use-intl";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { hashSsoSecret, randomSsoSecret } from "@/api/lib/sso-protocol";
import SsoConfirmEmailTemplate from "@/emails/sso-confirm-email";
import { CONFIG } from "@/lib/config";
import { normalizeEmailAddress } from "@/lib/email-canonical";

import type { SSOCallbackOutcome } from "./sso";

import { SSOModel } from "./sso";
import { SsoConnectionModel } from "./sso-connection";

/** How long a confirmation link works. The pending sign-in lives as long. */
export const SSO_EMAIL_LINK_TTL_MS = 30 * 60_000;
export const SSO_EMAIL_LINK_MAX_SENDS = 5;
export const SSO_EMAIL_LINK_COOLDOWN_MS = 30_000;

export type SsoEmailCompletionError =
  | "invalid_link"
  | "invalid_pending"
  | "too_many_emails";

const failure = (status: 400 | 429, error: SsoEmailCompletionError) =>
  new HTTPException(status, { message: error });

/**
 * The last step for a provider identity that brought no trustworthy email:
 * the visitor names an address, opens the link emailed to it in the same
 * browser, and only then is an account created - or the existing account's
 * password asked for before linking. Server-only.
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
   * Checks the link from the email against this browser's pending identity
   * and consumes it once: signs in the member it is linked to by now, signs
   * up a new member with the confirmed address, or returns the link offer for
   * the account that already owns it.
   *
   * @throws `HTTPException(400)` with `invalid_pending` when this browser has
   * no pending sign-in (another browser, or expired), and `invalid_link` for
   * an expired, replaced or already used link.
   */
  async confirm({
    providerId,
    token,
  }: {
    providerId: string;
    token: string;
  }): Promise<
    Extract<SSOCallbackOutcome, { kind: "link_required" | "signed_in" }>
  > {
    const tokenHash = this.pendingTokenHash();
    const now = new Date();
    const pending = await this.sso.flowStore.consumeConfirmed({
      confirmHash: hashSsoSecret(token),
      now,
      tokenHash,
    });
    if (!pending) {
      const waiting = await this.sso.flowStore.findPending({ now, tokenHash });
      throw failure(400, waiting ? "invalid_link" : "invalid_pending");
    }

    this.sso.clearPendingCookie();
    const provider = this.c
      .get("core")
      .authorization.ssoAdapters.find(one => one.id === providerId);
    if (!(provider && pending.providerId === providerId && pending.email)) {
      throw failure(400, "invalid_pending");
    }

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

  /**
   * Emails a fresh confirmation link to `email` for this browser's pending
   * identity, replacing any earlier link. Says nothing about whether the
   * address has an account.
   *
   * @throws `HTTPException(400)` without a live pending identity for
   * `providerId`, `429` past five emails or within 30 seconds of the last one.
   */
  async sendLink({
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
    const token = randomSsoSecret();
    const expiresAt = new Date(now.getTime() + SSO_EMAIL_LINK_TTL_MS);
    const stored = await this.sso.flowStore.setPendingConfirmation({
      confirmHash: hashSsoSecret(token),
      cooldownMs: SSO_EMAIL_LINK_COOLDOWN_MS,
      email: address,
      expiresAt,
      maxSends: SSO_EMAIL_LINK_MAX_SENDS,
      now,
      tokenHash,
    });
    if (!stored) throw failure(429, "too_many_emails");

    this.sso.refreshPendingCookie(expiresAt);
    const confirmUrl = new URL(
      `login/sso/${providerId}?confirm=${encodeURIComponent(token)}`,
      CONFIG.web.href,
    );

    await this.c.get("email").send({
      content: props =>
        SsoConfirmEmailTemplate({
          ...props,
          confirmUrl: confirmUrl.href,
          expiryDate: expiresAt,
          userIpAddress: this.c.get("ipAddress"),
        }),
      locale: this.c.get("i18n").resolveLocale(),
      subject: ({ i18n }) =>
        createTranslator(i18n)("core.auth.sso_confirm_email.email.subject"),
      to: address,
    });
  }
}
