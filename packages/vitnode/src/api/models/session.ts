import type { Context, Env, Input } from 'hono';

import { core_sessions } from '@/database/sessions';
import { CONFIG } from '@/lib/config';
import { and, eq, gt } from 'drizzle-orm';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import { UserModel } from './user';

export class SessionModel<T extends Env> {
  constructor(c: Context<T, '/', Input>) {
    this.c = c;
  }
  protected readonly c: Context<T, '/', Input>;

  async createSessionByUserId(userId: number) {
    // Generate secure random bytes using Web Crypto API
    const randomBytes = new Uint8Array(64);
    crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const deviceId = this.c.get('deviceId');

    await this.c
      .get('db')
      .insert(core_sessions)
      .values({
        token,
        userId,
        expiresAt: new Date(
          Date.now() + this.c.get('core').authorization.cookie_expires,
        ),
        deviceId,
      });

    setCookie(this.c, this.c.get('core').authorization.cookieName, token, {
      httpOnly: true,
      secure: this.c.get('core').authorization.cookieSecure,
      path: '/',
      expires:
        this.c.get('core').authorization.cookie_expires > 0
          ? new Date(
              Date.now() + this.c.get('core').authorization.cookie_expires,
            )
          : undefined,
      domain: CONFIG.frontend.hostname,
    });

    return { token, deviceId };
  }

  async deleteSession() {
    const token = getCookie(
      this.c,
      this.c.get('core').authorization.cookieName,
    );
    if (!token) return;

    await this.c
      .get('db')
      .delete(core_sessions)
      .where(eq(core_sessions.token, token));
    deleteCookie(this.c, this.c.get('core').authorization.cookieName);
  }

  async getUser() {
    const token = getCookie(
      this.c,
      this.c.get('core').authorization.cookieName,
    );
    if (!token) return null;
    const deviceId = this.c.get('deviceId');
    if (!deviceId) return null;

    const [session] = await this.c
      .get('db')
      .select({
        token: core_sessions.token,
        userId: core_sessions.userId,
      })
      .from(core_sessions)
      .where(
        and(
          eq(core_sessions.token, token),
          eq(core_sessions.deviceId, deviceId),
          gt(core_sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session || session.token !== token) {
      return null;
    }
    const user = await new UserModel().getUserById({
      id: session.userId,
      c: this.c,
    });
    if (!user) return null;

    return user;
  }
}
