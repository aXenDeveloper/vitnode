import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";

import { setAuthCookie } from "@/api/lib/auth-cookie";
import { core_sessions_known_devices } from "@/database/sessions";

export const DEVICE_TOUCH_INTERVAL_MS = 60 * 1000;

interface DeviceFingerprint {
  ipAddress: string;
  userAgent: string;
}

export const isDeviceTouchDue = ({
  current,
  now,
  stored,
}: {
  current: DeviceFingerprint;
  now: Date;
  stored: DeviceFingerprint & { lastSeen: Date };
}) =>
  stored.ipAddress !== current.ipAddress ||
  stored.userAgent !== current.userAgent ||
  now.getTime() - stored.lastSeen.getTime() >= DEVICE_TOUCH_INTERVAL_MS;

export const DEVICE_CACHE_TTL_SECONDS = 10 * 60;

export const deviceCacheKey = (publicId: string): string =>
  `device:${publicId}`;

interface CachedDevice extends DeviceFingerprint {
  id: number;
  lastSeen: string;
}

interface KnownDevice {
  id: number;
  publicId: string;
}

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

  private getDeviceCookie(): string | undefined {
    return getCookie(this.c, this.c.get("core").authorization.deviceCookieName);
  }

  private getFingerprint(): DeviceFingerprint {
    return {
      ipAddress: this.c.get("ipAddress"),
      userAgent: this.getUserAgent(),
    };
  }

  private getUserAgent() {
    return this.c.req.header("User-Agent") ?? "node";
  }

  private async resolveDevice(
    publicId: string,
    now: Date,
  ): Promise<KnownDevice | null> {
    const [stored] = await this.c
      .get("db")
      .select({
        id: core_sessions_known_devices.id,
        ipAddress: core_sessions_known_devices.ipAddress,
        userAgent: core_sessions_known_devices.userAgent,
        lastSeen: core_sessions_known_devices.lastSeen,
      })
      .from(core_sessions_known_devices)
      .where(eq(core_sessions_known_devices.publicId, publicId));

    if (!stored) return null;

    const current = this.getFingerprint();
    const touchDue = isDeviceTouchDue({ stored, current, now });
    const seen = touchDue ? { ...current, lastSeen: now } : stored;

    if (touchDue) {
      await this.c
        .get("db")
        .update(core_sessions_known_devices)
        .set({ ...current, lastSeen: now })
        .where(eq(core_sessions_known_devices.id, stored.id));
    }

    await this.c.get("cache").setSystem<CachedDevice>(
      deviceCacheKey(publicId),
      {
        id: stored.id,
        ipAddress: seen.ipAddress,
        userAgent: seen.userAgent,
        lastSeen: seen.lastSeen.toISOString(),
      },
      DEVICE_CACHE_TTL_SECONDS,
    );

    return { id: stored.id, publicId };
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
  async getExistingDeviceId(): Promise<KnownDevice | null> {
    const publicId = this.getDeviceCookie();
    if (!publicId) return null;

    const now = new Date();
    const cached = await this.c
      .get("cache")
      .getSystem<CachedDevice>(deviceCacheKey(publicId));

    if (
      cached &&
      !isDeviceTouchDue({
        stored: { ...cached, lastSeen: new Date(cached.lastSeen) },
        current: this.getFingerprint(),
        now,
      })
    ) {
      return { id: cached.id, publicId };
    }

    return await this.resolveDevice(publicId, now);
  }

  /**
   * The device for this request, creating and cookie-ing one if there is none.
   *
   * For the paths that are *establishing* something - signing in, signing up -
   * where a new device record is the correct outcome rather than a side effect.
   */
  async getOrCreateDeviceId(): Promise<KnownDevice> {
    const publicId = this.getDeviceCookie();
    const existing = publicId
      ? await this.resolveDevice(publicId, new Date())
      : null;

    return existing ?? (await this.createDevice());
  }
}
