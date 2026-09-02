import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";

import { setAuthCookie } from "@/api/lib/auth-cookie";
import { core_sessions_known_devices } from "@/database/sessions";

export class DeviceModel {
  constructor(c: Context) {
    this.c = c;
  }
  protected readonly c: Context;

  private async createDevice() {
    const publicId = randomBytes(16).toString("hex");

    const [device] = await this.c
      .get("db")
      .insert(core_sessions_known_devices)
      .values({
        publicId,
        ipAddress: this.c.get("ipAddress"),
        userAgent: this.getUserAgent(),
      })
      .returning({ id: core_sessions_known_devices.id });

    this.setCookieDevice(publicId);

    return { id: device.id, publicId };
  }

  private getUserAgent() {
    return this.c.req.header("User-Agent") ?? "node";
  }

  private setCookieDevice(publicDeviceId: string) {
    setAuthCookie(
      this.c,
      this.c.get("core").authorization.deviceCookieName,
      publicDeviceId,
      {
        expires: new Date(
          Date.now() + this.c.get("core").authorization.deviceCookieExpires,
        ),
      },
    );
  }

  /**
   * The device this request already has a record for, or `null`.
   *
   * Reads only - and that distinction is the point. A session row is tied to a
   * device row, so a request with no device on file cannot be carrying a valid
   * session, and *reading* one is the only thing session resolution needs. It
   * used to call {@link getOrCreateDeviceId} instead, which meant any request
   * with a made-up `vitnode_auth` cookie inserted a `core_sessions_known_devices`
   * row before discovering the session did not exist. Unauthenticated, and one
   * row per request, for as long as anybody cared to keep sending them.
   */
  async getExistingDeviceId(): Promise<null | {
    id: number;
    publicId: string;
  }> {
    const deviceIdFromCookie = getCookie(
      this.c,
      this.c.get("core").authorization.deviceCookieName,
    );
    if (!deviceIdFromCookie) return null;

    try {
      const [device] = await this.c
        .get("db")
        .select({ id: core_sessions_known_devices.id })
        .from(core_sessions_known_devices)
        .where(eq(core_sessions_known_devices.publicId, deviceIdFromCookie));

      if (!device) return null;

      await this.c
        .get("db")
        .update(core_sessions_known_devices)
        .set({
          ipAddress: this.c.get("ipAddress"),
          userAgent: this.getUserAgent(),
          lastSeen: new Date(),
        })
        .where(eq(core_sessions_known_devices.publicId, deviceIdFromCookie));

      return { id: device.id, publicId: deviceIdFromCookie };
    } catch {
      return null;
    }
  }

  /**
   * The device for this request, creating and cookie-ing one if there is none.
   *
   * For the paths that are *establishing* something - signing in, signing up -
   * where a new device record is the correct outcome rather than a side effect.
   */
  async getOrCreateDeviceId() {
    return (await this.getExistingDeviceId()) ?? (await this.createDevice());
  }
}
