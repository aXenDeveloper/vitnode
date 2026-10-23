import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { SsoProfileField } from "@/lib/sso-profile";

import { deleteAuthCookie, setAuthCookie } from "@/api/lib/auth-cookie";
import { isUniqueViolation } from "@/api/lib/db-errors";
import { isPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { ensureServerSecret } from "@/api/lib/server-secret";
import { ssoConfirmsEmail } from "@/api/lib/sso-email-confirmation";
import {
  hashSsoSecret,
  pkceChallengeS256,
  randomSsoSecret,
  timingSafeEqualText,
} from "@/api/lib/sso-protocol";
import {
  emailAliases,
  matchesEmail,
  pickAccountForEmail,
} from "@/api/lib/user-email-lookup";
import { core_users, core_users_sso } from "@/database/users";
import { CONFIG } from "@/lib/config";
import { removeSpecialCharacters } from "@/lib/special-characters";

import type { SsoFlowStore } from "./sso-flow-store";

import { isEmailVerificationRequired } from "./email-verification";
import { PasswordModel } from "./password";
import {
  SsoConnectionModel,
  ssoIdentityOf,
  type SsoProviderIdentity,
} from "./sso-connection";
import { drizzleSsoFlowStore } from "./sso-flow-store";
import {
  createSsoLinkToken,
  SSO_LINK_SECRET_NAME,
  type SsoLinkOffer,
  verifySsoLinkToken,
} from "./sso-link-token";
import { UserModel } from "./user";

/** The account an SSO provider returned, as an adapter's `fetchUser` maps it. */
export interface SSOProviderUser {
  /** Profile picture URL (HTTPS), for profile sync. `null` when the provider has none. */
  avatarUrl?: null | string;
  /**
   * The account's email, or `null` when the provider shares none. Only an
   * address core can trust (see `emailVerified`) is matched against existing
   * accounts or stored as verified; anything else sends a new visitor through
   * email confirmation instead.
   */
  email?: null | string;
  /**
   * Whether the provider confirmed the user owns `email`. `false` means core
   * never trusts the address: a returning member still signs in by `id`, and a
   * new one confirms an address of their own with a code. Leave it unset only
   * when the provider never returns an unconfirmed address.
   */
  emailVerified?: boolean;
  firstName?: null | string;
  /** The provider's stable account id, stored to recognise the account next time. Up to 255 characters. */
  id: string;
  lastName?: null | string;
  /** Becomes the new user's name (special characters removed) on sign-up. A generic name is used when `null`. */
  username?: null | string;
}

/**
 * What a provider's token endpoint answered. Adapters may keep any extra
 * field they need later in `fetchUser` (an `id_token`, TikTok's `open_id`...).
 */
export interface SSOTokenResponse {
  [field: string]: unknown;
  access_token: string;
  /** The OpenID Connect ID token, when the provider issued one. */
  id_token?: string;
  token_type: string;
}

/** What core hands `getUrl` for one sign-in attempt. */
export interface SSOAuthorizationRequest {
  /** The PKCE `S256` challenge of {@link SSOCallbackContext.codeVerifier}. Send it when the provider supports PKCE. */
  codeChallenge: string;
  codeChallengeMethod: "S256";
  /** A fresh OpenID Connect nonce. Send it when the provider echoes it in the ID token. */
  nonce: string;
  /** Pass through unchanged. */
  state: string;
}

/**
 * The attempt's secrets, given back to `fetchToken` and `fetchUser`. They are
 * stored server-side between the two legs and never reach the browser.
 */
export interface SSOCallbackContext {
  /** The PKCE verifier matching the challenge `getUrl` received. */
  codeVerifier: string;
  /** The nonce `getUrl` received; check it against the ID token's `nonce`. */
  nonce: string;
  /**
   * Extra parameters the provider sent to the callback besides `code` and
   * `state` - Apple's `user` field on a first authorization, for instance.
   * Untrusted input: validate before use.
   */
  params: Readonly<Record<string, string>>;
}

/**
 * An SSO (OAuth / OpenID Connect) provider adapter, listed in the API config's
 * `authorization.ssoAdapters`. Core's built-in adapters live in
 * `@vitnode/core/api/adapters/sso/*`; a custom provider implements this shape.
 *
 * Sign-in flow: `getUrl` sends the browser to the provider with a state,
 * PKCE challenge and nonce that core stores server-side, single use, for ten
 * minutes, bound to the browser and the provider. The provider redirects to
 * {@link getRedirectUri}; core consumes the attempt, then calls `fetchToken`
 * and `fetchUser`. A known identity signs in by its `id`, whatever the email
 * says. An unknown one with a trusted email signs up, or - when that email
 * belongs to an account - links after that account's password. An unknown one
 * without a trusted email confirms an address with an emailed code first.
 *
 * Server-only.
 */
export interface SSOApiPlugin {
  /** The sign-in button's background color, e.g. `"#5865f2"`; the text color is picked for contrast. */
  brandColor?: string;
  /** Exchanges the authorization code for tokens. Throw an `HTTPException` to fail the sign-in. */
  fetchToken: (
    code: string,
    context: SSOCallbackContext,
  ) => Promise<SSOTokenResponse>;
  /**
   * Reads the provider account with the tokens. Validate an ID token here when
   * the provider issues one. Report an address the provider has not confirmed
   * with `emailVerified: false` - an unconfirmed email must never reach core
   * as a trusted one.
   */
  fetchUser: (
    token: SSOTokenResponse,
    context: SSOCallbackContext,
  ) => Promise<SSOProviderUser>;
  /** The provider's authorization URL. Must pass `state` through unchanged and use {@link getRedirectUri} as the redirect URI. */
  getUrl: (request: SSOAuthorizationRequest) => string;
  /** The button's icon, as SVG markup. */
  icon?: string;
  /** Unique provider id, used in URLs (`login/sso/{id}`) and to store linked accounts. Letters, digits, `_` and `-`. */
  id: string;
  /** The provider's display name, e.g. `"Google"`. */
  name: string;
  /** Which profile fields `fetchUser` supplies, so users can sync them from this provider. Defaults to none. */
  profileFields?: readonly SsoProfileField[];
}

export type SSOCallbackOutcome =
  | { email: null | string; kind: "email_required" }
  | {
      email: string;
      hasPassword: boolean;
      kind: "link_required";
      linkToken: string;
    }
  | { kind: "email_unavailable" }
  | { kind: "signed_in"; userId: number };

/**
 * The OAuth redirect URI for provider `code`: `login/sso/{code}` under
 * `VITNODE_WEB_URL`. Register it with the provider, and send the same value
 * from `getUrl` and `fetchToken`.
 */
export const getRedirectUri = (code: string) =>
  new URL(`${CONFIG.web.href}login/sso/${code}`).toString();

/** How long a sign-in round trip may take, provider screens included. */
export const SSO_ATTEMPT_TTL_MS = 10 * 60_000;

/** How long an identity may wait for its email to be confirmed. */
export const SSO_PENDING_TTL_MS = 30 * 60_000;

const NAME_MAX_LENGTH = 32;

const COOKIE_SECRET = /^[\w-]{43,128}$/;

/**
 * Hands the identity of an attempt on: a provider account the visitor just
 * proved they own, plus how far core may trust its email.
 */
interface VerifiedIdentity {
  identity: SsoProviderIdentity;
  trustedEmail: null | string;
  untrustedEmail: null | string;
}

export class SSOModel {
  constructor(c: Context<EnvVitNode>) {
    this.c = c;
    this.plugins = c.get("core").authorization.ssoAdapters;
  }

  private readonly c: Context<EnvVitNode>;
  private readonly plugins: SSOApiPlugin[];

  private cookieName(suffix: "binding" | "pending"): string {
    return `${this.c.get("core").authorization.cookieName}--sso-${suffix}`;
  }

  private async linkSecret(): Promise<string> {
    return await ensureServerSecret(this.c.get("db"), SSO_LINK_SECRET_NAME);
  }

  private async mintLinkToken(offer: SsoLinkOffer): Promise<string> {
    return createSsoLinkToken({ offer, secret: await this.linkSecret() }).token;
  }

  private provider(providerId: string): SSOApiPlugin {
    const provider = this.plugins.find(p => p.id === providerId);
    if (!provider) throw new HTTPException(404);

    return provider;
  }

  private readCookieSecret(suffix: "binding" | "pending"): null | string {
    const value = getCookie(this.c, this.cookieName(suffix));

    return value && COOKIE_SECRET.test(value) ? value : null;
  }

  /**
   * Signs up a new member for a provider identity, linked to it. The name is
   * the provider's username, or "{Provider} user", with a short suffix when
   * another member already holds it.
   */
  private async signUpLinked({
    email,
    identity,
    provider,
  }: {
    email: string;
    identity: SsoProviderIdentity;
    provider: SSOApiPlugin;
  }): Promise<number> {
    const base = removeSpecialCharacters(
      identity.username ?? `${provider.name} user`,
      false,
    )
      .slice(0, NAME_MAX_LENGTH)
      .trim();
    const fallback = base.length >= 3 ? base : `${provider.name} user`;

    for (let attempt = 0; ; attempt++) {
      const name =
        attempt === 0
          ? fallback
          : `${fallback.slice(0, NAME_MAX_LENGTH - 5).trim()} ${randomDigits(4)}`;

      try {
        const userId = await this.createAccount({ email, name });
        await this.c.get("db").insert(core_users_sso).values({
          providerAccountId: identity.id,
          providerEmail: identity.email,
          providerId: provider.id,
          providerUsername: identity.username,
          userId,
        });

        return userId;
      } catch (error) {
        const nameTaken =
          error instanceof HTTPException &&
          error.status === 409 &&
          error.message === "Name already exists";
        if (!nameTaken || attempt >= 3) throw error;
      }
    }
  }

  private async verifyIdentity({
    code,
    params,
    providerId,
    state,
  }: {
    code: string;
    params: Readonly<Record<string, string>>;
    providerId: string;
    state: string;
  }): Promise<VerifiedIdentity & { provider: SSOApiPlugin }> {
    const attempt = await this.consumeAttempt({ providerId, state });
    const provider = this.provider(providerId);
    const context = {
      codeVerifier: attempt.codeVerifier,
      nonce: attempt.nonce,
      params,
    };

    const token = await provider.fetchToken(code, context);
    const user = await provider.fetchUser(token, context);
    const identity = ssoIdentityOf(provider, user);
    if (!identity.id) {
      throw new HTTPException(502, { message: "Invalid provider account" });
    }

    return {
      identity,
      provider,
      trustedEmail: identity.email,
      untrustedEmail:
        identity.email ??
        (typeof user.email === "string" ? user.email.slice(0, 255) : null),
    };
  }

  /**
   * Finishes a provider round trip: sign in, sign up, ask to link, or ask for
   * an email. Throws `400` for a state that is unknown, expired, already used,
   * from another browser or for another provider.
   */
  async callback({
    code,
    params = {},
    providerId,
    state,
  }: {
    code: string;
    params?: Readonly<Record<string, string>>;
    providerId: string;
    state: string;
  }): Promise<SSOCallbackOutcome> {
    const { identity, provider, trustedEmail, untrustedEmail } =
      await this.verifyIdentity({ code, params, providerId, state });

    const linked = await this.findLinkedUser(providerId, identity.id);
    if (linked) {
      if (
        trustedEmail &&
        ssoConfirmsEmail({
          accountEmail: linked.email,
          emailVerified: linked.emailVerified,
          providerEmail: trustedEmail,
        })
      ) {
        await this.c
          .get("db")
          .update(core_users)
          .set({ emailVerified: true })
          .where(eq(core_users.id, linked.userId));
      }

      await new SsoConnectionModel(this.c).afterSignIn({
        identity,
        providerId,
        userId: linked.userId,
      });

      return { kind: "signed_in", userId: linked.userId };
    }

    if (trustedEmail) {
      return await this.signUpOrOfferLink({
        email: trustedEmail,
        identity,
        provider,
      });
    }

    if (!isEmailVerificationRequired(this.c)) {
      return { kind: "email_unavailable" };
    }

    const token = randomSsoSecret();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SSO_PENDING_TTL_MS);
    await this.flowStore.savePending(
      {
        expiresAt,
        profile: identity.profile,
        providerAccountId: identity.id,
        providerId,
        providerUsername: identity.username,
        tokenHash: hashSsoSecret(token),
      },
      now,
    );
    setAuthCookie(this.c, this.cookieName("pending"), token, {
      expires: expiresAt,
    });

    return { email: untrustedEmail, kind: "email_required" };
  }

  clearPendingCookie(): void {
    deleteAuthCookie(this.c, this.cookieName("pending"));
  }

  /**
   * Consumes the attempt `state` names - once - and checks it belongs to this
   * browser and this provider and has not expired.
   *
   * @throws `HTTPException(400)` otherwise.
   */
  async consumeAttempt({
    providerId,
    state,
  }: {
    providerId: string;
    state: string;
  }): Promise<{ codeVerifier: string; nonce: string }> {
    const invalid = () => new HTTPException(400, { message: "Invalid state" });
    const binding = this.readCookieSecret("binding");
    if (!binding || state.length > 256) throw invalid();

    const attempt = await this.flowStore.consumeAttempt(hashSsoSecret(state));
    if (
      !attempt ||
      attempt.expiresAt.getTime() <= Date.now() ||
      attempt.providerId !== providerId ||
      !timingSafeEqualText(attempt.bindingHash, hashSsoSecret(binding))
    ) {
      throw invalid();
    }

    return { codeVerifier: attempt.codeVerifier, nonce: attempt.nonce };
  }

  /**
   * Creates a member whose email is already proven - by the provider, or by
   * the emailed code. `409` when the name or the address is taken.
   */
  async createAccount({
    email,
    name,
  }: {
    email: string;
    name: string;
  }): Promise<number> {
    const user = await new UserModel().signUp(
      {
        email,
        emailVerified: true,
        hashedPassword: undefined,
        name,
        newsletter: false,
      },
      this.c,
    );

    return user.id;
  }

  /** The member already linked to this provider account, if any. */
  async findLinkedUser(
    providerId: string,
    providerAccountId: string,
  ): Promise<null | { email: string; emailVerified: boolean; userId: number }> {
    const [row] = await this.c
      .get("db")
      .select({
        email: core_users.email,
        emailVerified: core_users.emailVerified,
        userId: core_users_sso.userId,
      })
      .from(core_users_sso)
      .innerJoin(core_users, eq(core_users.id, core_users_sso.userId))
      .where(
        and(
          eq(core_users_sso.providerId, providerId),
          eq(core_users_sso.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Starts a sign-in: stores a single-use attempt (state, PKCE verifier,
   * nonce) bound to this browser through an HttpOnly cookie, and returns the
   * provider URL.
   */
  async getUrl(providerId: string) {
    const provider = this.provider(providerId);
    const binding = this.readCookieSecret("binding") ?? randomSsoSecret();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SSO_ATTEMPT_TTL_MS);
    const state = randomSsoSecret();
    const codeVerifier = randomSsoSecret(48);
    const nonce = randomSsoSecret();

    await this.flowStore.saveAttempt(
      {
        bindingHash: hashSsoSecret(binding),
        codeVerifier,
        expiresAt,
        nonce,
        providerId,
        stateHash: hashSsoSecret(state),
      },
      now,
    );
    setAuthCookie(this.c, this.cookieName("binding"), binding, {
      expires: expiresAt,
    });

    return provider.getUrl({
      codeChallenge: pkceChallengeS256(codeVerifier),
      codeChallengeMethod: "S256",
      nonce,
      state,
    });
  }

  async link({
    password,
    providerId,
    token,
  }: {
    password: string;
    providerId: string;
    token: string;
  }): Promise<{ userId: number }> {
    if (!this.plugins.some(p => p.id === providerId)) {
      throw new HTTPException(404);
    }

    const offer = verifySsoLinkToken({
      providerId,
      secret: await this.linkSecret(),
      token,
    });
    if (!offer) {
      throw new HTTPException(400, { message: "Invalid link token" });
    }

    const [user] = await this.c
      .get("db")
      .select({
        id: core_users.id,
        email: core_users.email,
        emailVerified: core_users.emailVerified,
        password: core_users.password,
      })
      .from(core_users)
      .where(eq(core_users.id, offer.userId))
      .limit(1);
    const passwords = new PasswordModel();

    if (!user?.password || !emailAliases(offer.email).includes(user.email)) {
      await passwords.verifyDummyPassword(password);

      throw new HTTPException(403);
    }

    if (!(await passwords.verifyPassword(password, user.password))) {
      throw new HTTPException(403);
    }

    await this.c
      .get("db")
      .transaction(async tx => {
        const [existing] = await tx
          .select({ userId: core_users_sso.userId })
          .from(core_users_sso)
          .where(
            and(
              eq(core_users_sso.providerId, providerId),
              eq(core_users_sso.providerAccountId, offer.providerAccountId),
            ),
          )
          .limit(1);

        if (existing && existing.userId !== user.id) {
          throw new HTTPException(409, {
            message: "Provider account already linked",
          });
        }

        if (!existing) {
          const [otherAccount] = await tx
            .select({ userId: core_users_sso.userId })
            .from(core_users_sso)
            .where(
              and(
                eq(core_users_sso.userId, user.id),
                eq(core_users_sso.providerId, providerId),
              ),
            )
            .limit(1);

          if (otherAccount) {
            throw new HTTPException(409, {
              message: "Another account from this provider is already linked",
            });
          }

          await tx.insert(core_users_sso).values({
            userId: user.id,
            providerId,
            providerAccountId: offer.providerAccountId,
            providerEmail: offer.providerEmail ?? null,
          });
        }

        if (
          ssoConfirmsEmail({
            accountEmail: user.email,
            emailVerified: user.emailVerified,
            providerEmail: offer.email,
          })
        ) {
          await tx
            .update(core_users)
            .set({ emailVerified: true })
            .where(eq(core_users.id, user.id));
        }
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new HTTPException(409, {
            message: "Provider account already linked",
          });
        }

        throw error;
      });

    await this.c.get("events").emit("user.sso.linked", {
      email: user.email,
      providerId,
      userId: user.id,
    });

    return { userId: user.id };
  }

  /**
   * The new identity's next step once core holds an email it trusts - from
   * the provider, or confirmed with a code: a fresh account, or the existing
   * account's password before linking.
   */
  async signUpOrOfferLink({
    email,
    identity,
    provider,
    providerEmail = email,
  }: {
    email: string;
    identity: SsoProviderIdentity;
    provider: SSOApiPlugin;
    /** The address to record as the provider's own; `null` when the provider shared none. */
    providerEmail?: null | string;
  }): Promise<
    Extract<SSOCallbackOutcome, { kind: "link_required" | "signed_in" }>
  > {
    const accountsWithEmail = await this.c
      .get("db")
      .select({
        email: core_users.email,
        id: core_users.id,
        password: core_users.password,
      })
      .from(core_users)
      .where(matchesEmail(email))
      .limit(2);
    const existing = pickAccountForEmail(accountsWithEmail, email);

    if (!existing) {
      const userId = await this.signUpLinked({
        email,
        identity: { ...identity, email: providerEmail },
        provider,
      });

      return { kind: "signed_in", userId };
    }

    return {
      email: existing.email,
      hasPassword:
        isPasswordSignInEnabled(this.c) && existing.password !== null,
      kind: "link_required",
      linkToken: await this.mintLinkToken({
        email,
        providerAccountId: identity.id,
        providerEmail,
        providerId: provider.id,
        userId: existing.id,
      }),
    };
  }

  get flowStore(): SsoFlowStore {
    return drizzleSsoFlowStore(this.c.get("db"));
  }

  /** The pending identity this browser's cookie names, if it is still live. */
  get pendingToken(): null | string {
    return this.readCookieSecret("pending");
  }
}

const randomDigits = (length: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), byte =>
    (byte % 10).toString(),
  ).join("");
