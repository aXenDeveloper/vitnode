import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import crypto from "node:crypto";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { SsoProfileField } from "@/lib/sso-profile";

import { deleteAuthCookie, setAuthCookie } from "@/api/lib/auth-cookie";
import { isUniqueViolation } from "@/api/lib/db-errors";
import { isPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { ensureServerSecret } from "@/api/lib/server-secret";
import { ssoConfirmsEmail } from "@/api/lib/sso-email-confirmation";
import {
  emailAliases,
  matchesEmail,
  pickAccountForEmail,
} from "@/api/lib/user-email-lookup";
import { core_users, core_users_sso } from "@/database/users";
import { CONFIG } from "@/lib/config";
import { normalizeEmailAddress } from "@/lib/email-canonical";
import { removeSpecialCharacters } from "@/lib/special-characters";

import { PasswordModel } from "./password";
import { SsoConnectionModel, ssoIdentityOf } from "./sso-connection";
import {
  createSsoLinkToken,
  SSO_LINK_SECRET_NAME,
  verifySsoLinkToken,
} from "./sso-link-token";
import { UserModel } from "./user";

export interface SSOProviderUser {
  avatarUrl?: null | string;
  email: string;
  firstName?: null | string;
  id: string;
  lastName?: null | string;
  username: string;
}

export interface SSOApiPlugin {
  brandColor?: string;
  fetchToken: (
    code: string,
  ) => Promise<{ access_token: string; token_type: string }>;
  fetchUser: (args: {
    access_token: string;
    token_type: string;
  }) => Promise<SSOProviderUser>;
  getUrl: (props: { state: string }) => string;
  icon?: string;
  id: string;
  name: string;
  profileFields?: readonly SsoProfileField[];
}

export type SSOCallbackOutcome =
  | {
      email: string;
      hasPassword: boolean;
      kind: "link_required";
      linkToken: string;
    }
  | { kind: "signed_in"; userId: number };

export const getRedirectUri = (code: string) =>
  new URL(`${CONFIG.web.href}login/sso/${code}`).toString();

export class SSOModel {
  constructor(c: Context<EnvVitNode>) {
    this.c = c;
    this.plugins = c.get("core").authorization.ssoAdapters;
  }

  private readonly c: Context<EnvVitNode>;
  private readonly plugins: SSOApiPlugin[];

  private readonly signUpUser = async ({
    providerId,
    user,
    c,
  }: {
    c: Context;
    providerId: string;
    user: {
      email: string;
      id: string;
      username: string;
    };
  }) => {
    const data = await new UserModel().signUp(
      {
        email: user.email,
        emailVerified: true,
        name: removeSpecialCharacters(user.username, false),
        newsletter: false,
        hashedPassword: undefined,
      },
      c,
    );
    await c
      .get("db")
      .insert(core_users_sso)
      .values({
        userId: data.id,
        providerId: providerId,
        providerAccountId: user.id,
        providerEmail: user.email,
        providerUsername: user.username.slice(0, 255),
      });

    return { userId: data.id };
  };

  private async linkSecret(): Promise<string> {
    return await ensureServerSecret(this.c.get("db"), SSO_LINK_SECRET_NAME);
  }

  private async mintLinkToken(offer: {
    email: string;
    providerAccountId: string;
    providerId: string;
    userId: number;
  }): Promise<string> {
    return createSsoLinkToken({ offer, secret: await this.linkSecret() }).token;
  }

  async callback({
    code,
    providerId,
    state,
  }: {
    code: string;
    providerId: string;
    state: string;
  }): Promise<SSOCallbackOutcome> {
    await this.verifyState(state);
    const provider = this.plugins.find(p => p.id === providerId);
    if (!provider) {
      throw new HTTPException(404);
    }

    const ssoToken = await provider.fetchToken(code);
    const userFromProvider = await provider.fetchUser(ssoToken);
    const userFromSSO = {
      email: normalizeEmailAddress(userFromProvider.email),
      id: userFromProvider.id,
      username: userFromProvider.username,
    };

    const outcome = await this.c.get("db").transaction(async tx => {
      const [dataSSOFromDb] = await tx
        .select({
          userId: core_users_sso.userId,
          email: core_users.email,
          emailVerified: core_users.emailVerified,
        })
        .from(core_users_sso)
        .innerJoin(core_users, eq(core_users.id, core_users_sso.userId))
        .where(
          and(
            eq(core_users_sso.providerId, providerId),
            eq(core_users_sso.providerAccountId, userFromSSO.id),
          ),
        )
        .limit(1);

      if (!dataSSOFromDb) {
        const accountsWithEmail = await tx
          .select({
            id: core_users.id,
            email: core_users.email,
            password: core_users.password,
          })
          .from(core_users)
          .where(matchesEmail(userFromSSO.email))
          .limit(2);
        const userWithEmail = pickAccountForEmail(
          accountsWithEmail,
          userFromSSO.email,
        );

        if (!userWithEmail) {
          const signUpUser = await this.signUpUser({
            providerId,
            user: userFromSSO,
            c: this.c,
          });

          return { kind: "signed_in", userId: signUpUser.userId } as const;
        }

        return {
          email: userWithEmail.email,
          hasPassword:
            isPasswordSignInEnabled(this.c) && userWithEmail.password !== null,
          kind: "link_required" as const,
          linkToken: await this.mintLinkToken({
            email: userFromSSO.email,
            providerAccountId: userFromSSO.id,
            providerId,
            userId: userWithEmail.id,
          }),
        };
      }

      if (
        ssoConfirmsEmail({
          accountEmail: dataSSOFromDb.email,
          emailVerified: dataSSOFromDb.emailVerified,
          providerEmail: userFromSSO.email,
        })
      ) {
        await tx
          .update(core_users)
          .set({ emailVerified: true })
          .where(eq(core_users.id, dataSSOFromDb.userId));
      }

      return { kind: "returning", userId: dataSSOFromDb.userId } as const;
    });

    if (outcome.kind === "returning") {
      await new SsoConnectionModel(this.c).afterSignIn({
        identity: ssoIdentityOf(provider, userFromProvider),
        providerId,
        userId: outcome.userId,
      });

      return { kind: "signed_in", userId: outcome.userId };
    }

    return outcome;
  }

  async encryptState() {
    const state = crypto.randomBytes(8).toString("hex");
    const encryptedState = await new Promise<string>((resolve, reject) => {
      const salt = crypto.randomBytes(4).toString("hex");

      crypto.scrypt(state, salt, 16, (err, derivedKey) => {
        if (err) reject(err);

        resolve(`${salt}:${derivedKey.toString("hex")}`);
      });
    });

    // No `expires`: the state is only good for the round trip to the provider
    // and back, so it should not outlive the browser session.
    setAuthCookie(
      this.c,
      `${this.c.get("core").authorization.cookieName}--state-sso`,
      encryptedState,
    );

    return state;
  }

  async getUrl(providerId: string) {
    const provider = this.plugins.find(p => p.id === providerId);
    if (!provider) {
      throw new HTTPException(404);
    }

    return provider.getUrl({ state: await this.encryptState() });
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
            providerEmail: offer.email,
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

  async verifyState(state: string) {
    const storedState = getCookie(
      this.c,
      `${this.c.get("core").authorization.cookieName}--state-sso`,
    );
    if (!storedState) {
      throw new HTTPException(400, {
        message: "Invalid state",
      });
    }

    const isValid = await new Promise<boolean>((resolve, reject) => {
      const [salt, storedHash] = storedState.split(":");

      crypto.scrypt(state, salt, 16, (err, derivedKey) => {
        if (err) reject(err);
        resolve(storedHash === derivedKey.toString("hex"));
      });
    });

    if (!isValid) {
      throw new HTTPException(400, {
        message: "Invalid state",
      });
    }

    deleteAuthCookie(
      this.c,
      `${this.c.get("core").authorization.cookieName}--state-sso`,
    );
  }
}
