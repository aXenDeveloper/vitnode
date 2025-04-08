import { dbClient } from '@/database/client';
import {
  core_admin_permissions,
  core_admin_sessions,
} from '@/database/schema/admins';
import { CONFIG } from '@/lib/config';
import crypto from 'crypto';
import { and, eq, gt, or } from 'drizzle-orm';
import { Context, Env, Input } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

import { DeviceModel } from './device';
import { UserModel } from './user';

export class SessionAdminModel<T extends Env> extends DeviceModel<T> {
  constructor(c: Context<T, '/', Input>) {
    super(c);
  }

  async checkIfUserIsAdmin(userId: string) {
    const user = await new UserModel().getUserById(userId);
    if (!user) return false;

    const [permission] = await dbClient
      .select()
      .from(core_admin_permissions)
      .where(
        or(
          eq(core_admin_permissions.user_id, user.id),
          eq(core_admin_permissions.group_id, user.group_id),
        ),
      )
      .limit(1);

    return !!permission;
  }

  async createSessionByUserId(userId: string) {
    const isAdmin = await this.checkIfUserIsAdmin(userId);
    if (!isAdmin) throw new HTTPException(403);
    const token = crypto.randomBytes(64).toString('hex').normalize();
    const deviceId = await this.getDeviceId();

    await dbClient.insert(core_admin_sessions).values({
      token,
      user_id: userId,
      expires_at: new Date(
        Date.now() + this.c.get('core').authorization.adminCookieExpires,
      ),
      device_id: deviceId,
    });

    setCookie(this.c, this.c.get('core').authorization.adminCookieName, token, {
      httpOnly: true,
      secure: this.c.get('core').authorization.cookieSecure,
      sameSite: 'strict',
      path: '/admin',
      expires: new Date(
        Date.now() + this.c.get('core').authorization.adminCookieExpires,
      ),
      domain: CONFIG.frontend.hostname,
    });

    return { token, deviceId };
  }

  async deleteSession() {
    const token = getCookie(
      this.c,
      this.c.get('core').authorization.adminCookieName,
    );
    if (!token) return;

    await dbClient
      .delete(core_admin_sessions)
      .where(eq(core_admin_sessions.token, token));
    deleteCookie(this.c, this.c.get('core').authorization.adminCookieName, {
      path: '/admin',
    });
  }

  async verifySession() {
    const token = getCookie(
      this.c,
      this.c.get('core').authorization.adminCookieName,
    );
    if (!token) throw new HTTPException(403);
    const deviceId = getCookie(
      this.c,
      this.c.get('core').authorization.deviceCookieName,
    );
    if (!deviceId) throw new HTTPException(403);

    const [session] = await dbClient
      .select({
        token: core_admin_sessions.token,
        user_id: core_admin_sessions.user_id,
      })
      .from(core_admin_sessions)
      .where(
        and(
          eq(core_admin_sessions.token, token),
          gt(core_admin_sessions.expires_at, new Date()),
        ),
      )
      .limit(1);

    if (!session || session.token !== token) {
      throw new HTTPException(403);
    }
    const user = await new UserModel().getUserById(session.user_id);
    if (!user) throw new HTTPException(403);

    return user;
  }
}
