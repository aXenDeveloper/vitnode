import type { Context, Env, Next } from "hono";
import type { Redis } from "ioredis";

import { HTTPException } from "hono/http-exception";

import type { VitNodeApiConfig, VitNodeConfig } from "@/vitnode.config";
import type { VitNodeRealtime } from "@/ws/registry";

import { CacheModel } from "@/api/lib/cache";
import { EmailModel } from "@/api/models/email";
import { QueueModel } from "@/api/models/queue";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { StorageModel } from "@/api/models/storage";
import { CONFIG } from "@/lib/config";
import { realtime } from "@/ws/registry";

import type { BuildCronReturn } from "../lib/cron";
import type { PermissionStaffCatalogEntry } from "../lib/permission-staff";
import type { BuildQueueTaskReturn } from "../lib/queue";
import type { WebSocketConfig } from "../lib/websocket";
import type { SSOApiPlugin } from "../models/sso";

import {
  loggerMiddleware,
  type LoggerMiddlewareType,
} from "../lib/logger-middleware";
import { normalizePermissionStaffModules } from "../lib/permission-staff";

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
  cache: CacheModel;
  core: {
    authorization: {
      adminCookieExpires: number;
      adminCookieName: string;
      cookie_expires: number;
      cookieName: string;
      cookieSecure: boolean;
      deviceCookieExpires: number;
      deviceCookieName: string;
      ssoAdapters: SSOApiPlugin[];
    };
    captcha?: Pick<VitNodeApiConfig, "captcha">["captcha"];
    cron: (BuildCronReturn & { module: string; pluginId: string })[];
    cronSecret?: string;
    email?: VitNodeApiConfig["email"];
    // Whether a cron adapter is configured (`buildApiConfig({ cron })`), i.e. an
    // in-process scheduler is running the registered jobs automatically. Without
    // it, jobs only run when the cron endpoint is triggered externally.
    hasCronAdapter: boolean;
    metadata: {
      shortTitle?: string;
      title: string;
    };
    pathToMessages: (path: string) => Promise<{ default: object }>;
    permissionStaff: PermissionStaffCatalogEntry[];
    plugins: { id: string }[];
    queue: (BuildQueueTaskReturn & { module: string; pluginId: string })[];
    storage?: VitNodeApiConfig["storage"];
    webSockets: WebSocketConfig[];
  };
  db: Pick<VitNodeApiConfig, "dbProvider">["dbProvider"];
  email: EmailModel;
  ipAddress: string;
  log: LoggerMiddlewareType;
  plugin: {
    id: string;
  };
  queue: QueueModel;
  realtime: VitNodeRealtime;
  storage: StorageModel;
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

export const globalMiddleware = ({
  authorization,
  metadata,
  email,
  dbProvider,
  captcha,
  cron,
  plugins,
  pathToMessages,
  storage,
  cacheClient,
}: Pick<
  VitNodeApiConfig,
  | "authorization"
  | "captcha"
  | "cron"
  | "dbProvider"
  | "email"
  | "pathToMessages"
  | "plugins"
  | "storage"
> &
  Pick<VitNodeConfig, "metadata"> & { cacheClient: null | Redis }) => {
  const pluginsMetadata = plugins.map(plugin => ({
    id: plugin.pluginId,
  }));

  const cronMetadata = plugins.flatMap(plugin =>
    (plugin.cronJobs ?? []).map(cronJob => ({
      pluginId: plugin.pluginId,
      module: cronJob.module,
      name: cronJob.name,
      schedule: cronJob.schedule,
      handler: cronJob.handler,
      description: cronJob.description,
    })),
  );

  const queueMetadata = plugins.flatMap(plugin =>
    (plugin.queueTasks ?? []).map(task => ({
      pluginId: plugin.pluginId,
      module: task.module,
      name: task.name,
      handler: task.handler,
      description: task.description,
      maxAttempts: task.maxAttempts,
    })),
  );

  const webSocketsMetadata: WebSocketConfig[] = plugins.flatMap(plugin =>
    (plugin.webSockets ?? []).map(webSocket => ({
      ...webSocket,
      pluginId: plugin.pluginId,
    })),
  );

  const permissionStaffMetadata: PermissionStaffCatalogEntry[] = plugins.map(
    plugin => ({
      pluginId: plugin.pluginId,
      admin: normalizePermissionStaffModules(plugin.permissionStaff?.admin),
      moderator: normalizePermissionStaffModules(
        plugin.permissionStaff?.moderator,
      ),
    }),
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
    c.set("cache", new CacheModel(cacheClient, c));
    c.set("email", new EmailModel(c));
    c.set("queue", new QueueModel(c));
    c.set("storage", new StorageModel(c));
    c.set("realtime", realtime);

    c.set("core", {
      pathToMessages,
      metadata,
      email,
      storage,
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
      hasCronAdapter: !!cron,
      plugins: pluginsMetadata,
      cron: cronMetadata,
      queue: queueMetadata,
      webSockets: webSocketsMetadata,
      permissionStaff: permissionStaffMetadata,
    });

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
