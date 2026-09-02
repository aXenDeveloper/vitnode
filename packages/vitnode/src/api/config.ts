import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env, Schema } from "hono";

import { swaggerUI } from "@hono/swagger-ui";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";

import type { VitNodeApiConfig } from "@/vitnode.config";

import { createCacheClient } from "@/api/lib/cache-client";
import { clientIpMiddleware } from "@/api/lib/client-ip";
import { collectCronJobs } from "@/api/lib/cron";
import { describeError } from "@/api/lib/error-details";
import { newBuildPluginApiCore } from "@/api/plugin";
import { CONFIG_PLUGIN } from "@/config";
import { CONFIG } from "@/lib/config";
import { initRealtimePubSub } from "@/ws/registry";

import {
  globalAdminMiddleware,
  globalMiddleware,
} from "./middlewares/global.middleware";
import { rateLimiterMiddleware } from "./middlewares/rate-limiter.middleware";
import { registerCronJobs } from "./modules/cron/helpers/register-cron-jobs";

/** 25 MB: room for an image upload, and nothing like enough to be a weapon. */
const DEFAULT_MAX_BODY_SIZE = 25 * 1024 * 1024;

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

  const plugins = [newBuildPluginApiCore, ...vitNodeApiConfig.plugins];

  // The generated document names every route, parameter and response shape in
  // the install, including the admin tree - a map of the attack surface, handed
  // out unauthenticated. Published in development, where it is the point, and
  // in production only when an install asks for it via `docs: { enabled: true }`.
  const docsEnabled = vitNodeApiConfig.docs?.enabled ?? CONFIG.node_development;

  if (docsEnabled) {
    app.doc("/swagger/doc", {
      openapi: "3.0.0",
      info: {
        version: CONFIG_PLUGIN.version,
        title: "VitNode API",
      },
      tags: plugins.flatMap(
        plugin => plugin.openApiTags?.map(name => ({ name })) ?? [],
      ),
    });
  }

  app.use(cors(corsOptions));
  app.use(csrf(csrfOptions));
  // Before the rate limiter, which keys its buckets on `ipAddress`. Resolving it
  // later - as `globalMiddleware` used to - left every request in the
  // deployment sharing one bucket named after `undefined`.
  app.use("*", clientIpMiddleware(vitNodeApiConfig.trustProxy));
  // Nothing bounded a request body before this. `POST /sign_in` reads its JSON
  // and then runs scrypt unconditionally, so a body the server is willing to
  // buffer is memory *and* CPU an unauthenticated caller gets to choose the size
  // of. Uploads are the one thing that legitimately needs room, and they are
  // bounded per field by the Content Engine's own `maxBytes`; this is the outer
  // wall, and `maxBodySize` moves it for an install that stores large media.
  app.use(
    "*",
    bodyLimit({
      maxSize: vitNodeApiConfig.maxBodySize ?? DEFAULT_MAX_BODY_SIZE,
      onError: c => c.json({ error: "Payload Too Large" }, 413),
    }),
  );
  app.use(
    "*",
    rateLimiterMiddleware(vitNodeApiConfig.rateLimiter, redisClient),
  );
  if (docsEnabled) {
    app.get("/swagger", swaggerUI({ url: "/api/swagger/doc" }));
  }
  app.use(
    "*",
    globalMiddleware({
      ai: vitNodeApiConfig.ai,
      i18n: vitNodeApiConfig.i18n,
      email: vitNodeApiConfig.email,
      metadata: vitNodeApiConfig.metadata,
      authorization: vitNodeApiConfig.authorization,
      dbProvider: vitNodeApiConfig.dbProvider,
      captcha: vitNodeApiConfig.captcha,
      content: vitNodeApiConfig.content,
      cron: vitNodeApiConfig.cron,
      events: vitNodeApiConfig.events,
      search: vitNodeApiConfig.search,
      storage: vitNodeApiConfig.storage,
      plugins,
      cacheClient: redisClient,
      trustProxy: vitNodeApiConfig.trustProxy,
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

  plugins.map(root => {
    app.route(`/${root.pluginId}`, root.hono);
  });

  registerCronJobs(vitNodeApiConfig.dbProvider, collectCronJobs(plugins)).catch(
    (error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mFailed to register cron jobs:\x1b[0m ${describeError(error)}`,
      );
    },
  );

  app.onError(async (error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    const errorMessage = describeError(error);

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
