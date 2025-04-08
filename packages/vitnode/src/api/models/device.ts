import { dbClient } from '@/database/client';
import { core_sessions_known_devices } from '@/database/schema/sessions';
import { CONFIG } from '@/lib/config';
import { eq } from 'drizzle-orm';
import { Context, Env, Input } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

import { getUserIp } from '../lib/get-user-ip';

export class DeviceModel<T extends Env> {
  constructor(c: Context<T, '/', Input>) {
    this.c = c;
  }
  protected readonly c: Context<T, '/', Input>;

  private async createDevice() {
    const [device] = await dbClient
      .insert(core_sessions_known_devices)
      .values({
        ip_address: getUserIp(this.c.req),
        user_agent: this.getUserAgent(),
      })
      .returning({ id: core_sessions_known_devices.id });

    this.setCookieDevice(device.id);

    return device.id;
  }

  private getUserAgent() {
    return this.c.req.header('User-Agent') ?? 'node';
  }

  private setCookieDevice(deviceId: string) {
    setCookie(
      this.c,
      this.c.get('core').authorization.deviceCookieName,
      deviceId,
      {
        httpOnly: true,
        secure: this.c.get('core').authorization.cookieSecure,
        sameSite: 'strict',
        path: '/',
        domain: CONFIG.frontend.hostname,
        expires: new Date(
          Date.now() + this.c.get('core').authorization.deviceCookieExpires,
        ),
      },
    );
  }

  async getDeviceId() {
    const deviceIdFromCookie = getCookie(
      this.c,
      this.c.get('core').authorization.deviceCookieName,
    );

    if (deviceIdFromCookie) {
      const [device] = await dbClient
        .select({
          id: core_sessions_known_devices.id,
        })
        .from(core_sessions_known_devices)
        .where(eq(core_sessions_known_devices.id, deviceIdFromCookie));

      if (!device) {
        return await this.createDevice();
      }

      await dbClient
        .update(core_sessions_known_devices)
        .set({
          ip_address: getUserIp(this.c.req),
          user_agent: this.getUserAgent(),
        })
        .where(eq(core_sessions_known_devices.id, deviceIdFromCookie));

      return device.id;
    }

    return await this.createDevice();
  }
}
