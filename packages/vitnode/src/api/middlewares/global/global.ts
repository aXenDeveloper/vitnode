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
      metadata: {
        shortTitle?: string;
        title: string;
      };
    };
  }
}

export const globalMiddleware = ({
  authorization,
  metadata,
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
  metadata: {
    shortTitle?: string;
    title: string;
  };
}) => {
  return async (c: Context<Env, '*'>, next: Next) => {
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

    await next();
  };
};
