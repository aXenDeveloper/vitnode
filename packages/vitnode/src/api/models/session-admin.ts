import type { Context } from 'hono';

import { and, eq, gt, or } from 'drizzle-orm';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

import { core_admin_permissions, core_admin_sessions } from '@/database/admins';
import { CONFIG } from '@/lib/config';

import { UserModel } from './user';

export class SessionAdminModel {
  constructor(c: Context) {
    this.c = c;
  }
  protected readonly c: Context;

  async checkIfUserIsAdmin(userId: number) {
    const user = await new UserModel().getUserById({ id: userId, c: this.c });
    if (!user) return false;

    const [permission] = await this.c
      .get('db')
      .select()
      .from(core_admin_permissions)
      .where(
        or(
          eq(core_admin_permissions.userId, user.id),
          eq(core_admin_permissions.roleId, user.roleId),
        ),
      )
      .limit(1);

    return !!permission;
  }

  async createSessionByUserId(userId: number) {
    const isAdmin = await this.checkIfUserIsAdmin(userId);
    if (!isAdmin) throw new HTTPException(403);

    // Generate secure random bytes using Web Crypto API
    const randomBytes = new Uint8Array(64);
    crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const deviceId = this.c.get('deviceId');

    await this.c
      .get('db')
      .insert(core_admin_sessions)
      .values({
        token,
        userId,
        expiresAt: new Date(
          Date.now() + this.c.get('core').authorization.adminCookieExpires,
        ),
        deviceId,
      });

    setCookie(this.c, this.c.get('core').authorization.adminCookieName, token, {
      httpOnly: true,
      secure: this.c.get('core').authorization.cookieSecure,

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

    await this.c
      .get('db')
      .delete(core_admin_sessions)
      .where(eq(core_admin_sessions.token, token));
    deleteCookie(this.c, this.c.get('core').authorization.adminCookieName, {
      path: '/admin',
    });
  }

  async getUser() {
    const { authorization } = this.c.get('core');
    const token = getCookie(this.c, authorization.adminCookieName);
    if (!token) return null;
    const deviceId = this.c.get('deviceId');
    if (!deviceId) return null;

    const [session] = await this.c
      .get('db')
      .select({
        token: core_admin_sessions.token,
        userId: core_admin_sessions.userId,
      })
      .from(core_admin_sessions)
      .where(
        and(
          eq(core_admin_sessions.token, token),
          eq(core_admin_sessions.deviceId, deviceId),
          gt(core_admin_sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) return null;
    const user = await new UserModel().getUserById({
      id: session.userId,
      c: this.c,
    });
    if (!user) return null;

    return user;
  }
}
