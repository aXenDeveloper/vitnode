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

  async getDeviceId() {
    const deviceIdFromCookie = getCookie(
      this.c,
      this.c.get("core").authorization.deviceCookieName,
    );

    try {
      if (deviceIdFromCookie) {
        const [device] = await this.c
          .get("db")
          .select({
            id: core_sessions_known_devices.id,
          })
          .from(core_sessions_known_devices)
          .where(eq(core_sessions_known_devices.publicId, deviceIdFromCookie));

        if (!device) {
          return await this.createDevice();
        }

        await this.c
          .get("db")
          .update(core_sessions_known_devices)
          .set({
            ipAddress: this.c.get("ipAddress"),
            userAgent: this.getUserAgent(),
            lastSeen: new Date(),
          })
          .where(eq(core_sessions_known_devices.publicId, deviceIdFromCookie));

        return {
          id: device.id,
          publicId: deviceIdFromCookie,
        };
      }
    } catch {
      /* empty */
    }

    return await this.createDevice();
  }
}
