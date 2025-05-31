import type { Context, Env, Next } from 'hono';

import { HTTPException } from 'hono/http-exception';

import type { EmailApiPlugin } from '@/api/models/email';
import type { VitNodeApiConfig, VitNodeConfig } from '@/vitnode.config';

import { DeviceModel } from '@/api/models/device';
import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';

import type { SSOApiPlugin } from '../../models/sso';

declare module 'hono' {
  interface ContextVariableMap {
    admin: null | {
      user: {
        avatarColor: string;
        birthday: Date | null;
        createdAt: Date;
        email: string;
        emailVerified: boolean;
        id: number;
        name: string;
        nameCode: string;
        newsletter: boolean;
        roleId: number;
      };
    };
    core: {
      authorization: {
        adminCookieExpires: number;
        adminCookieName: string;
        cookie_expires: number;
        cookieName: string;
        cookieSecure: boolean;
        deviceCookieExpires: number;
        deviceCookieName: string;
        ssoPlugins: SSOApiPlugin[];
      };
      emailProvider?: EmailApiPlugin;
      metadata: {
        shortTitle?: string;
        title: string;
      };
    };
    db: Pick<VitNodeApiConfig, 'dbProvider'>['dbProvider'];
    deviceId: number;
    user: null | {
      avatarColor: string;
      birthday: Date | null;
      createdAt: Date;
      email: string;
      emailVerified: boolean;
      id: number;
      name: string;
      nameCode: string;
      newsletter: boolean;
      roleId: number;
    };
  }
}

export const globalMiddleware = ({
  authorization,
  metadata,
  emailProvider,
  dbProvider,
}: Pick<VitNodeApiConfig, 'authorization' | 'dbProvider' | 'emailProvider'> &
  Pick<VitNodeConfig, 'metadata'>) => {
  return async (c: Context<Env, '*'>, next: Next) => {
    c.set('db', dbProvider);

    c.set('core', {
      metadata,
      emailProvider,
      authorization: {
        cookieName: authorization?.cookieName ?? 'vitnode_auth',
        cookie_expires:
          authorization?.cookieExpires ?? 1000 * 60 * 60 * 24 * 90, // 90 days
        ssoPlugins: authorization?.ssoPlugins ?? [],
        deviceCookieName: authorization?.deviceCookieName ?? 'vitnode_device',
        deviceCookieExpires:
          authorization?.deviceCookieExpires ?? 1000 * 60 * 60 * 24 * 365, // 1 year,
        adminCookieName: authorization?.adminCookieName ?? 'vitnode_auth_admin',
        adminCookieExpires:
          authorization?.adminCookieExpires ?? 1000 * 60 * 60 * 24 * 1, // 1 day
        cookieSecure: authorization?.cookieSecure ?? true,
      },
    });

    const deviceId = await new DeviceModel(c).getDeviceId();
    c.set('deviceId', deviceId);
    const user = await new SessionModel(c).getUser();
    c.set('user', user);
    c.set('admin', null);

    await next();
  };
};

export const globalAdminMiddleware = () => {
  return async (c: Context<Env, '*'>, next: Next) => {
    const user = await new SessionAdminModel(c).getUser();
    if (!user) throw new HTTPException(403);
    c.set('admin', {
      user,
    });

    await next();
  };
};
