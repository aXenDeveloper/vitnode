import type { Context } from 'hono';

import { eq } from 'drizzle-orm';
import { getCookie, setCookie } from 'hono/cookie';

import { core_sessions_known_devices } from '@/database/sessions';
import { CONFIG } from '@/lib/config';

import { getUserIp } from '../lib/get-user-ip';

export class DeviceModel {
  constructor(c: Context) {
    this.c = c;
  }
  protected readonly c: Context;

  private async createDevice() {
    const [device] = await this.c
      .get('db')
      .insert(core_sessions_known_devices)
      .values({
        ipAddress: getUserIp(this.c),
        userAgent: this.getUserAgent(),
      })
      .returning({ id: core_sessions_known_devices.id });

    this.setCookieDevice(device.id);

    return device.id;
  }

  private getUserAgent() {
    return this.c.req.header('User-Agent') ?? 'node';
  }

  private setCookieDevice(deviceId: number) {
    setCookie(
      this.c,
      this.c.get('core').authorization.deviceCookieName,
      deviceId.toString(),
      {
        httpOnly: true,
        secure: this.c.get('core').authorization.cookieSecure,
        path: '/',
        domain: CONFIG.frontend.hostname,
        expires: new Date(
          Date.now() + this.c.get('core').authorization.deviceCookieExpires,
        ),
      },
    );
  }

  async getDeviceId() {
    const deviceIdFromCookie = Number(
      getCookie(this.c, this.c.get('core').authorization.deviceCookieName),
    );

    try {
      if (deviceIdFromCookie) {
        const [device] = await this.c
          .get('db')
          .select({
            id: core_sessions_known_devices.id,
          })
          .from(core_sessions_known_devices)
          .where(eq(core_sessions_known_devices.id, deviceIdFromCookie));

        if (!device) {
          return await this.createDevice();
        }

        await this.c
          .get('db')
          .update(core_sessions_known_devices)
          .set({
            ipAddress: getUserIp(this.c),
            userAgent: this.getUserAgent(),
          })
          .where(eq(core_sessions_known_devices.id, deviceIdFromCookie));

        return device.id;
      }
    } catch (_) {
      return await this.createDevice();
    }

    return await this.createDevice();
  }
}
