import type { Context } from "hono";

import { and, eq, gt, or } from "drizzle-orm"; // Removed 'or' as it's safer not to use it here
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

import { core_admin_permissions, core_admin_sessions } from "@/database/admins";
import { CONFIG } from "@/lib/config";

import { DeviceModel } from "./device";
import { UserModel } from "./user";

export class SessionAdminModel {
  constructor(c: Context) {
    this.c = c;
  }
  protected readonly c: Context;

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async checkIfUserIsAdmin(userId: number) {
    const user = await new UserModel().getUserById({ id: userId, c: this.c });
    if (!user) return false;

    const [permission] = await this.c
      .get("db")
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
    if (!isAdmin) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const randomBytes = new Uint8Array(64);
    crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const hashedToken = await this.hashToken(token);
    const device = await new DeviceModel(this.c).getDeviceId();

    await this.c
      .get("db")
      .insert(core_admin_sessions)
      .values({
        token: hashedToken,
        userId,
        expiresAt: new Date(
          Date.now() + this.c.get("core").authorization.adminCookieExpires,
        ),
        deviceId: device.id,
      });

    setCookie(this.c, this.c.get("core").authorization.adminCookieName, token, {
      httpOnly: true,
      secure: this.c.get("core").authorization.cookieSecure,
      path: "/",
      expires: new Date(
        Date.now() + this.c.get("core").authorization.adminCookieExpires,
      ),
      domain: CONFIG.web.hostname,
    });

    return { token };
  }

  async deleteSession() {
    const token = getCookie(
      this.c,
      this.c.get("core").authorization.adminCookieName,
    );
    if (!token) return;

    const hashedToken = await this.hashToken(token);

    await this.c
      .get("db")
      .delete(core_admin_sessions)
      .where(eq(core_admin_sessions.token, hashedToken));

    deleteCookie(this.c, this.c.get("core").authorization.adminCookieName, {
      path: "/",
      domain: CONFIG.web.hostname,
    });
  }

  async getUser() {
    const { authorization } = this.c.get("core");
    const token = getCookie(this.c, authorization.adminCookieName);
    if (!token) return null;

    const device = await new DeviceModel(this.c).getDeviceId();
    if (!device) return null;

    const hashedToken = await this.hashToken(token);

    const [session] = await this.c
      .get("db")
      .select({
        userId: core_admin_sessions.userId,
      })
      .from(core_admin_sessions)
      .where(
        and(
          eq(core_admin_sessions.token, hashedToken),
          eq(core_admin_sessions.deviceId, device.id),
          gt(core_admin_sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      deleteCookie(this.c, this.c.get("core").authorization.adminCookieName, {
        path: "/",
        domain: CONFIG.web.hostname,
      });

      return null;
    }

    const user = await new UserModel().getUserById({
      id: session.userId,
      c: this.c,
    });

    if (!user) return null;
    const isStillAdmin = await this.checkIfUserIsAdmin(user.id);
    if (!isStillAdmin) {
      await this.deleteSession();

      return null;
    }

    return user;
  }
}
