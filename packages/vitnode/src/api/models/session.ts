import type { Context } from "hono";

import { and, eq, gt } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { core_sessions } from "@/database/sessions";
import { CONFIG } from "@/lib/config";

import { DeviceModel } from "./device";
import { UserModel } from "./user";

export class SessionModel {
  constructor(c: Context) {
    this.c = c;
  }
  protected readonly c: Context;

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(hashBuffer);

    // Optimize: Use direct iteration instead of Array.from + map
    let result = "";
    for (const byte of bytes) {
      result += byte.toString(16).padStart(2, "0");
    }

    return result;
  }

  async createSessionByUserId(userId: number) {
    // Generate secure random bytes using Web Crypto API
    const randomBytes = new Uint8Array(64);
    crypto.getRandomValues(randomBytes);

    // Optimize: Use direct iteration instead of Array.from + map
    let token = "";
    for (const byte of randomBytes) {
      token += byte.toString(16).padStart(2, "0");
    }

    const device = await new DeviceModel(this.c).getDeviceId();
    const hashedToken = await this.hashToken(token);

    await this.c
      .get("db")
      .insert(core_sessions)
      .values({
        token: hashedToken,
        userId,
        expiresAt: new Date(
          Date.now() + this.c.get("core").authorization.cookie_expires,
        ),
        deviceId: device.id,
      });

    setCookie(this.c, this.c.get("core").authorization.cookieName, token, {
      httpOnly: true,
      secure: this.c.get("core").authorization.cookieSecure,
      path: "/",
      expires:
        this.c.get("core").authorization.cookie_expires > 0
          ? new Date(
              Date.now() + this.c.get("core").authorization.cookie_expires,
            )
          : undefined,
      domain: CONFIG.web.hostname,
    });

    return { token };
  }

  async deleteSession() {
    const token = getCookie(
      this.c,
      this.c.get("core").authorization.cookieName,
    );
    const device = await new DeviceModel(this.c).getDeviceId();

    // Ensure both token and deviceId exist before proceeding
    if (!(token && device.id)) {
      deleteCookie(this.c, this.c.get("core").authorization.cookieName);

      return;
    }

    const hashedToken = await this.hashToken(token);

    await this.c
      .get("db")
      .delete(core_sessions)
      // Harden the query to ensure a user can only delete their own device's session
      .where(
        and(
          eq(core_sessions.token, hashedToken),
          eq(core_sessions.deviceId, device.id),
        ),
      );

    deleteCookie(this.c, this.c.get("core").authorization.cookieName);
  }

  async getUser() {
    const token = getCookie(
      this.c,
      this.c.get("core").authorization.cookieName,
    );
    if (!token) return null;

    const device = await new DeviceModel(this.c).getDeviceId();
    if (!device) return null;

    const hashedToken = await this.hashToken(token);

    const [session] = await this.c
      .get("db")
      .select({
        userId: core_sessions.userId,
      })
      .from(core_sessions)
      .where(
        and(
          eq(core_sessions.token, hashedToken),
          eq(core_sessions.deviceId, device.id),
          gt(core_sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      deleteCookie(this.c, this.c.get("core").authorization.cookieName);

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
