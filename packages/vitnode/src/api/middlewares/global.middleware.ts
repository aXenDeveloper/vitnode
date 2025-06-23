import type { Context, Env, Next } from 'hono';

import { HTTPException } from 'hono/http-exception';

import type { EmailApiPlugin } from '@/api/models/email';
import type { VitNodeApiConfig, VitNodeConfig } from '@/vitnode.config';

import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';

import type { SSOApiPlugin } from '../models/sso';

import {
  loggerMiddleware,
  type LoggerMiddlewareType,
} from '../lib/logger-middleware';

export interface EnvVitNode extends Env {
  Variables: EnvVariablesVitNode;
}

interface EnvVariablesVitNode {
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
      ssoProviders: SSOApiPlugin[];
    };
    emailAdapter?: EmailApiPlugin;
    metadata: {
      shortTitle?: string;
      title: string;
    };
  };
  db: Pick<VitNodeApiConfig, 'dbProvider'>['dbProvider'];
  ipAddress: string;
  log: LoggerMiddlewareType;
  plugin: {
    id: string;
  };
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

declare module 'hono' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends EnvVariablesVitNode {}
}

export const globalMiddleware = ({
  authorization,
  metadata,
  emailAdapter,
  dbProvider,
}: Pick<VitNodeApiConfig, 'authorization' | 'dbProvider' | 'emailAdapter'> &
  Pick<VitNodeConfig, 'metadata'>) => {
  return async (c: Context, next: Next) => {
    // Collect possible IP header keys in order of trust/preference
    const ipHeaderKeys = [
      'x-forwarded-for',
      'x-real-ip',
      'cf-connecting-ip',
      'x-client-ip',
      'x-forwarded',
      'x-cluster-client-ip',
      'forwarded-for',
      'forwarded',
      'via',
      'remote-addr',
      'client-ip',
      'ip',
      'x-ip',
      'true-client-ip',
      'fastly-client-ip',
      'x-fastly-client-ip',
    ];

    let ipAddress: string | undefined;

    // Try to get IP from Hono's request header method first
    for (const key of ipHeaderKeys) {
      const value = c.req.header(key);
      if (value) {
        ipAddress = value;
        break;
      }
    }

    // If not found, try raw headers (for edge runtimes, etc.)
    if (!ipAddress) {
      for (const key of ipHeaderKeys) {
        const value = c.req.raw.headers.get(key);
        if (value) {
          ipAddress = value;
          break;
        }
      }
    }

    // Fallback to localhost if nothing found
    c.set('ipAddress', ipAddress ?? '127.0.0.1');
    c.set('db', dbProvider);

    c.set('core', {
      metadata,
      emailAdapter,
      authorization: {
        cookieName: authorization?.cookieName ?? 'vitnode_auth',
        cookie_expires:
          authorization?.cookieExpires ?? 1000 * 60 * 60 * 24 * 90, // 90 days
        ssoProviders: authorization?.ssoProviders ?? [],
        deviceCookieName: authorization?.deviceCookieName ?? 'vitnode_device',
        deviceCookieExpires:
          authorization?.deviceCookieExpires ?? 1000 * 60 * 60 * 24 * 365, // 1 year,
        adminCookieName: authorization?.adminCookieName ?? 'vitnode_auth_admin',
        adminCookieExpires:
          authorization?.adminCookieExpires ?? 1000 * 60 * 60 * 24 * 1, // 1 day
        cookieSecure: authorization?.cookieSecure ?? true,
      },
    });

    const user = await new SessionModel(c).getUser();
    c.set('user', user);
    c.set('admin', null);
    c.set('log', loggerMiddleware(c));

    await next();
  };
};

export const pluginMiddleware = (pluginId: string) => {
  return async (c: Context, next: Next) => {
    c.set('plugin', {
      id: pluginId,
    });
    await next();
  };
};

export const globalAdminMiddleware = () => {
  return async (c: Context, next: Next) => {
    const user = await new SessionAdminModel(c).getUser();
    if (!user) throw new HTTPException(403);
    c.set('admin', {
      user,
    });

    await next();
  };
};
