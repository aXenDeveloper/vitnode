import { EmailApiPlugin } from '@/api/models/email';
import { Context, Env, Next } from 'hono';

import { SSOApiPlugin } from '../../models/sso';

declare module 'hono' {
  interface ContextVariableMap {
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
      site: {
        name: string;
        nameShort?: string;
      };
    };
  }
}

export const globalMiddleware = ({
  authorization,
  site,
  emailProvider,
}: {
  authorization?: {
    adminCookieExpires?: number;
    adminCookieName?: string;
    cookieExpires?: number;
    cookieName?: string;
    cookieSecure?: boolean;
    deviceCookieExpires?: number;
    deviceCookieName?: string;
    ssoPlugins?: SSOApiPlugin[];
  };
  emailProvider?: EmailApiPlugin;
  site: {
    name: string;
    nameShort?: string;
  };
}) => {
  return async (c: Context<Env, '*'>, next: Next) => {
    c.set('core', {
      site,
      emailProvider,
      authorization: {
        cookieName: authorization?.cookieName ?? 'vitnode-auth',
        cookie_expires:
          authorization?.cookieExpires ?? 1000 * 60 * 60 * 24 * 90, // 90 days
        ssoPlugins: authorization?.ssoPlugins ?? [],
        deviceCookieName: authorization?.deviceCookieName ?? 'vitnode-device',
        deviceCookieExpires:
          authorization?.deviceCookieExpires ?? 1000 * 60 * 60 * 24 * 365, // 1 year,
        adminCookieName: authorization?.adminCookieName ?? 'vitnode-admin',
        adminCookieExpires:
          authorization?.adminCookieExpires ?? 1000 * 60 * 60 * 24 * 1, // 1 day
        cookieSecure: authorization?.cookieSecure ?? true,
      },
    });

    await next();
  };
};
