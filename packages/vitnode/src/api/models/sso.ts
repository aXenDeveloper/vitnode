import type { Context } from 'hono';

import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

import { core_users, core_users_sso } from '@/database/users';
import { CONFIG } from '@/lib/config';
import { removeSpecialCharacters } from '@/lib/special-characters';

import { UserModel } from './user';

export interface SSOApiPlugin {
  fetchToken: (
    code: string,
  ) => Promise<{ access_token: string; token_type: string }>;
  fetchUser: (args: {
    access_token: string;
    token_type: string;
  }) => Promise<{ email: string; id: string; username: string }>;
  getUrl: (props: { state: string }) => string;
  id: string;
  name: string;
}

export const getRedirectUri = (code: string) =>
  new URL(`${CONFIG.web.href}login/sso/${code}`).toString();

export class SSOModel {
  constructor(c: Context) {
    this.c = c;
    this.plugins = c.get('core').authorization.ssoAdapters;
  }

  private readonly c: Context;
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
        name: removeSpecialCharacters(user.username, false),
        newsletter: false,
        hashedPassword: undefined,
      },
      c,
    );
    await c.get('db').insert(core_users_sso).values({
      userId: data.id,
      providerId: providerId,
      providerAccountId: user.id,
    });

    return { userId: data.id };
  };

  async callback({
    code,
    providerId,
    state,
  }: {
    code: string;
    providerId: string;
    state: string;
  }): Promise<{
    userId: number;
  }> {
    await this.verifyState(state);
    const provider = this.plugins.find(p => p.id === providerId);
    if (!provider) {
      throw new HTTPException(404);
    }

    const ssoToken = await provider.fetchToken(code);
    const userFromSSO = await provider.fetchUser(ssoToken);

    return await this.c.get('db').transaction(async tx => {
      const [dataSSOFromDb] = await tx
        .select({
          userId: core_users_sso.userId,
        })
        .from(core_users_sso)
        .leftJoin(core_users, eq(core_users.id, core_users_sso.userId))
        .where(
          and(
            eq(core_users_sso.providerId, providerId),
            eq(core_users_sso.providerAccountId, userFromSSO.id),
          ),
        )
        .limit(1);

      if (!dataSSOFromDb) {
        const [userWithEmail] = await tx
          .select({
            id: core_users.id,
            email: core_users.email,
          })
          .from(core_users)
          .where(eq(core_users.email, userFromSSO.email))
          .limit(1);

        if (!userWithEmail) {
          const signUpUser = await this.signUpUser({
            providerId,
            user: userFromSSO,
            c: this.c,
          });

          return signUpUser;
        }

        // If email exists, throw an error
        throw new HTTPException(409, {
          message: 'Email already exists',
        });
        // await tx.insert(core_users_sso).values({
        //   providerId: providerId,
        //   providerAccountId: userFromSSO.id,
        //   userId: userWithEmail.id,
        // });

        return {
          userId: userWithEmail.id,
        };
      }

      return {
        userId: dataSSOFromDb.userId,
      };
    });
  }

  async encryptState() {
    const state = crypto.randomBytes(8).toString('hex');
    const encryptedState = await new Promise<string>((resolve, reject) => {
      const salt = crypto.randomBytes(4).toString('hex');

      crypto.scrypt(state, salt, 16, (err, derivedKey) => {
        if (err) reject(err);

        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });

    setCookie(
      this.c,
      `${this.c.get('core').authorization.cookieName}--state-sso`,
      encryptedState,
      {
        httpOnly: true,
        secure: this.c.get('core').authorization.cookieSecure,
        path: '/',
        domain: CONFIG.web.hostname,
      },
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

  async verifyState(state: string) {
    const storedState = getCookie(
      this.c,
      `${this.c.get('core').authorization.cookieName}--state-sso`,
    );
    if (!storedState) {
      throw new HTTPException(400, {
        message: 'Invalid state',
      });
    }

    const isValid = await new Promise<boolean>((resolve, reject) => {
      const [salt, storedHash] = storedState.split(':');

      crypto.scrypt(state, salt, 16, (err, derivedKey) => {
        if (err) reject(err);
        resolve(storedHash === derivedKey.toString('hex'));
      });
    });

    if (!isValid) {
      throw new HTTPException(400, {
        message: 'Invalid state',
      });
    }

    deleteCookie(
      this.c,
      `${this.c.get('core').authorization.cookieName}--state-sso`,
    );
  }
}
