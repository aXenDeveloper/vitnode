import { dbClient } from '@/database/client';
import { core_sessions } from '@/database/schema/sessions';
import { CONFIG } from '@/lib/config';
import crypto from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { Context, Env, Input } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import { DeviceModel } from './device';
import { UserModel } from './user';

export class SessionModel<T extends Env> extends DeviceModel<T> {
  constructor(c: Context<T, '/', Input>) {
    super(c);
  }

  async createSessionByUserId(userId: string) {
    const token = crypto.randomBytes(64).toString('hex').normalize();
    const deviceId = await this.getDeviceId();

    await dbClient.insert(core_sessions).values({
      token,
      user_id: userId,
      expires_at: new Date(
        Date.now() + this.c.get('core').authorization.cookie_expires,
      ),
      device_id: deviceId,
    });

    setCookie(this.c, this.c.get('core').authorization.cookieName, token, {
      httpOnly: true,
      secure: this.c.get('core').authorization.cookieSecure,
      sameSite: 'strict',
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

    await dbClient.delete(core_sessions).where(eq(core_sessions.token, token));
    deleteCookie(this.c, this.c.get('core').authorization.cookieName);
  }

  async verifySession() {
    const token = getCookie(
      this.c,
      this.c.get('core').authorization.cookieName,
    );
    if (!token) return null;
    const deviceId = getCookie(
      this.c,
      this.c.get('core').authorization.deviceCookieName,
    );
    if (!deviceId) return null;

    const [session] = await dbClient
      .select({
        token: core_sessions.token,
        user_id: core_sessions.user_id,
      })
      .from(core_sessions)
      .where(
        and(
          eq(core_sessions.token, token),
          gt(core_sessions.expires_at, new Date()),
        ),
      )
      .limit(1);

    if (!session || session.token !== token) {
      return null;
    }
    const user = await new UserModel().getUserById(session.user_id);
    if (!user) return null;

    return user;
  }
}
