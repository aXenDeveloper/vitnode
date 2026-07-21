import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env, Schema } from "hono";

import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";

import type { VitNodeApiConfig } from "@/vitnode.config";

import { createCacheClient } from "@/api/lib/cache-client";
import { collectCronJobs } from "@/api/lib/cron";
import { newBuildPluginApiCore } from "@/api/plugin";
import { CONFIG_PLUGIN } from "@/config";
import { initRealtimePubSub } from "@/ws/registry";

import {
  globalAdminMiddleware,
  globalMiddleware,
} from "./middlewares/global.middleware";
import { rateLimiterMiddleware } from "./middlewares/rate-limiter.middleware";
import { registerCronJobs } from "./modules/cron/helpers/register-cron-jobs";

interface CORSOptions {
  allowHeaders?: string[];
  allowMethods?: string[];
  credentials?: boolean;
  exposeHeaders?: string[];
  maxAge?: number;
  origin:
    | ((origin: string, c: Context) => null | string | undefined)
    | string
    | string[];
}

type IsAllowedOriginHandler = (origin: string, context: Context) => boolean;
interface CSRFOptions {
  origin?: IsAllowedOriginHandler | string | string[];
}

export function VitNodeAPI({
  app,
  cors: corsOptions,
  csrf: csrfOptions,
  vitNodeApiConfig,
}: {
  app: OpenAPIHono<Env, Schema, string>;
  cors?: CORSOptions;
  csrf?: CSRFOptions;
  vitNodeApiConfig: VitNodeApiConfig;
}) {
  // Shared Redis client, created once at boot. Reused by the rate limiter
  // (which runs before the request context exists), the realtime pub/sub bridge,
  // and the per-request cache exposed as `c.get("cache")`. Safe no-op when
  // `redis` is unset.
  const redisClient = createCacheClient(vitNodeApiConfig.redis);

  // Bridge realtime (WebSocket) messages across instances via Redis pub/sub, so
  // `broadcast`/`sendToUser` reach clients on every instance. No-op without Redis.
  initRealtimePubSub(redisClient);

  app.doc("/swagger/doc", {
    openapi: "3.0.0",
    info: {
      version: CONFIG_PLUGIN.version,
      title: "VitNode API",
    },
  });
  app.use(cors(corsOptions));
  app.use(csrf(csrfOptions));
  app.use(
    "*",
    rateLimiterMiddleware(vitNodeApiConfig.rateLimiter, redisClient),
  );
  app.get("/swagger", swaggerUI({ url: "/api/swagger/doc" }));
  app.use(
    "*",
    globalMiddleware({
      pathToMessages: vitNodeApiConfig.pathToMessages,
      email: vitNodeApiConfig.email,
      metadata: vitNodeApiConfig.metadata,
      authorization: vitNodeApiConfig.authorization,
      dbProvider: vitNodeApiConfig.dbProvider,
      captcha: vitNodeApiConfig.captcha,
      cron: vitNodeApiConfig.cron,
      search: vitNodeApiConfig.search,
      storage: vitNodeApiConfig.storage,
      plugins: [newBuildPluginApiCore, ...vitNodeApiConfig.plugins],
      cacheClient: redisClient,
    }),
  );
  app.use(async (c, next) => {
    if (c.req.path.includes("/admin/")) {
      return await globalAdminMiddleware()(c, next);
    }

    return next();
  });

  if (vitNodeApiConfig.cron) {
    vitNodeApiConfig.cron.schedule();
  }

  const plugins = [newBuildPluginApiCore, ...vitNodeApiConfig.plugins];

  plugins.map(root => {
    app.route(`/${root.pluginId}`, root.hono);
  });

  registerCronJobs(vitNodeApiConfig.dbProvider, collectCronJobs(plugins)).catch(
    (error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mFailed to register cron jobs:\x1b[0m ${error}`,
      );
    },
  );

  app.onError(async (error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    const errorMessage = error?.message ?? "Unknown error";

    try {
      const logger = c.get("log");
      if (logger) {
        await logger.error(`Unhandled error: ${errorMessage}`);
      }
    } catch {
      /* empty */
    }

    return new Response(
      process.env.NODE_ENV === "development"
        ? errorMessage
        : "Internal Server Error",
      {
        status: 500,
      },
    );
  });

  return app;
}
