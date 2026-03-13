import type { Context, Env, Next } from "hono";

import { HTTPException } from "hono/http-exception";

import type { VitNodeApiConfig, VitNodeConfig } from "@/vitnode.config";

import { EmailModel, type EmailModelSendArgs } from "@/api/models/email";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONFIG } from "@/lib/config";

import type { BuildCronReturn } from "../lib/cron";
import type { SSOApiAdapter } from "../models/sso";

import {
  loggerMiddleware,
  type LoggerMiddlewareType,
} from "../lib/logger-middleware";
import { WebsocketModel } from "../models/websocket/model";
import {
  WebsocketManager,
  type WebsocketManagerConfig,
} from "../models/websocket/manager";

declare module "hono" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends EnvVariablesVitNode {}
}

export interface EnvVitNode extends Env {
  Variables: EnvVariablesVitNode;
}

export interface EnvVariablesVitNode {
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
      ssoAdapters: SSOApiAdapter[];
    };
    websocketManager: WebsocketManagerConfig;
    captcha?: Pick<VitNodeApiConfig, "captcha">["captcha"];
    cron: (BuildCronReturn & { module: string; pluginId: string })[];
    cronSecret?: string;
    email?: VitNodeApiConfig["email"];
    metadata: {
      shortTitle?: string;
      title: string;
    };
    pathToMessages: (path: string) => Promise<{ default: object }>;
    plugins: { id: string }[];
  };
  db: Pick<VitNodeApiConfig, "dbProvider">["dbProvider"];
  email: {
    send: (args: EmailModelSendArgs) => Promise<void>;
  };
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
  websocket: {
    test: () => void;
  };
}

export const globalMiddleware = ({
  authorization,
  metadata,
  email,
  dbProvider,
  captcha,
  plugins,
  pathToMessages,
}: Pick<
  VitNodeApiConfig,
  | "authorization"
  | "captcha"
  | "dbProvider"
  | "email"
  | "pathToMessages"
  | "plugins"
> &
  Pick<VitNodeConfig, "metadata">) => {
  const pluginsMetadata = plugins.map(plugin => ({
    id: plugin.pluginId,
  }));

  const cronMetadata = plugins.flatMap(plugin =>
    plugin.cronJobs.map(cronJob => ({
      pluginId: plugin.pluginId,
      module: cronJob.module,
      name: cronJob.name,
      schedule: cronJob.schedule,
      handler: cronJob.handler,
      description: cronJob.description,
    })),
  );

  const ipHeaderKeys = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-client-ip",
    "x-forwarded",
    "x-cluster-client-ip",
    "forwarded-for",
    "forwarded",
    "via",
    "remote-addr",
    "client-ip",
    "ip",
    "x-ip",
    "true-client-ip",
    "fastly-client-ip",
    "x-fastly-client-ip",
  ];

  return async (c: Context, next: Next) => {
    let ipAddress: string | undefined;

    // Optimize: Try both header methods in a single loop
    for (const key of ipHeaderKeys) {
      ipAddress = c.req.header(key);
      if (ipAddress) break;

      ipAddress = c.req.raw.headers.get(key) ?? undefined;
      if (ipAddress) break;
    }

    // Fallback to localhost if nothing found
    c.set("ipAddress", ipAddress ?? "127.0.0.1");
    c.set("db", dbProvider);

    c.set("core", {
      pathToMessages,
      metadata,
      email,
      authorization: {
        cookieName: authorization?.cookieName ?? "vitnode_auth",
        cookie_expires:
          authorization?.cookieExpires ?? 1000 * 60 * 60 * 24 * 90, // 90 days
        ssoAdapters: authorization?.ssoAdapters ?? [],
        deviceCookieName: authorization?.deviceCookieName ?? "vitnode_device",
        deviceCookieExpires:
          authorization?.deviceCookieExpires ?? 1000 * 60 * 60 * 24 * 365, // 1 year,
        adminCookieName: authorization?.adminCookieName ?? "vitnode_auth_admin",
        adminCookieExpires:
          authorization?.adminCookieExpires ?? 1000 * 60 * 60 * 24 * 1, // 1 day
        cookieSecure: authorization?.cookieSecure ?? true,
      },
      captcha,
      cronSecret: CONFIG.cronJobSecret,
      plugins: pluginsMetadata,
      cron: cronMetadata,
      websocketManager: new WebsocketManager(c),
    });

    c.set("email", new EmailModel(c));
    c.set("websocket", new WebsocketModel(c));

    const user = await new SessionModel(c).getUser();
    c.set("user", user);
    c.set("admin", null);
    c.set("log", loggerMiddleware(c));

    await next();
  };
};

export const pluginMiddleware = (pluginId: string) => {
  return async (c: Context, next: Next) => {
    c.set("plugin", {
      id: pluginId,
    });
    await next();
  };
};

export const globalAdminMiddleware = () => {
  return async (c: Context, next: Next) => {
    const user = await new SessionAdminModel(c).getUser();
    if (!user) throw new HTTPException(403);
    c.set("admin", {
      user,
    });

    await next();
  };
};
