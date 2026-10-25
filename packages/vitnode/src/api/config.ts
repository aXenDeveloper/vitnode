import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env, Schema } from "hono";

import { swaggerUI } from "@hono/swagger-ui";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";

import type { VitNodeApiConfig } from "@/vitnode.config";

import { DEFAULT_SESSION_COOKIE_NAME } from "@/api/lib/auth-cookie";
import { createCacheClient } from "@/api/lib/cache-client";
import { clientIpMiddleware } from "@/api/lib/client-ip";
import { collectCronJobs } from "@/api/lib/cron";
import { describeError } from "@/api/lib/error-details";
import { processSingleton } from "@/api/lib/process-singleton";
import { newBuildPluginApiCore } from "@/api/plugin";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "@/blocks/registry";
import { CONFIG } from "@/lib/config";
import { manifest } from "@/manifest";
import {
  configurePageCacheStore,
  pageCacheRuntime,
  pageCacheStoreFor,
} from "@/page-cache/store.server";
import { initRealtimePubSub } from "@/ws/registry";

import {
  assertPluginContentModules,
  generatedContentModules,
  packageContentModules,
} from "./lib/content-modules";
import {
  globalAdminMiddleware,
  globalMiddleware,
} from "./middlewares/global.middleware";
import {
  exposeRateLimitHeaders,
  rateLimiterMiddleware,
} from "./middlewares/rate-limiter.middleware";
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

/**
 * Mounts VitNode on a Hono app: security headers, CORS, CSRF, the body limit,
 * rate limiting, the per-request context (`c.get("db")`, `c.get("cache")` and
 * friends), core and every plugin at `/{pluginId}`, cron registration, and an
 * error handler that hides details outside development. It returns the same
 * `app`.
 *
 * Call it at startup. Calling it again in the same process, as a dev server
 * does after a plugin's API code changes, builds a fresh set of routes while
 * the Redis connection and the cron schedule stay the ones created first.
 *
 * Server-only. Give `app` its base path (`/api`) before calling it.
 *
 * @throws At startup when the configuration is invalid - plugin content
 * modules, colliding registrations, misconfigured passkeys or locale domains.
 *
 * @example
 * ```ts
 * import { OpenAPIHono } from "@hono/zod-openapi";
 * import { VitNodeAPI } from "@vitnode/core/api/config";
 *
 * import { vitNodeApiConfig } from "./vitnode.api.config";
 *
 * const app = new OpenAPIHono().basePath("/api");
 * VitNodeAPI({ app, vitNodeApiConfig });
 * ```
 */
export function VitNodeAPI({
  app,
  cors: corsOptions,
  csrf: csrfOptions,
  vitNodeApiConfig,
}: {
  app: OpenAPIHono<Env, Schema, string>;
  /** Replaces the default CORS policy: credentials from `VITNODE_WEB_URL` only. */
  cors?: CORSOptions;
  /** Replaces the default CSRF check: requests from `VITNODE_WEB_URL` or the API's own origin. */
  csrf?: CSRFOptions;
  vitNodeApiConfig: VitNodeApiConfig;
}) {
  // Shared Redis client, created once at boot. Reused by the rate limiter
  // (which runs before the request context exists), the realtime pub/sub bridge,
  // and the per-request cache exposed as `c.get("cache")`. Without `redis` the
  // cache falls back to a small in-process store; see `MemoryCacheStore`.
  //
  // Process-wide, so a dev server that rebuilds the API after a plugin edit
  // reuses the connection instead of opening another one each time.
  const redisClient = vitNodeApiConfig.redis
    ? processSingleton(`redis:${JSON.stringify(vitNodeApiConfig.redis)}`, () =>
        createCacheClient(vitNodeApiConfig.redis),
      )
    : null;

  // Bridge realtime (WebSocket) messages across instances via Redis pub/sub, so
  // `broadcast`/`sendToUser` reach clients on every instance. No-op without Redis.
  initRealtimePubSub(redisClient);

  // A separate API process writes page invalidations to the web app's Redis.
  // Inside the web app the server entry has registered the store already.
  if (vitNodeApiConfig.pageCache && pageCacheRuntime() === undefined) {
    const store = pageCacheStoreFor(vitNodeApiConfig.pageCache.storage, {
      client: redisClient,
    });

    if (store === null) {
      // oxlint-disable-next-line no-console
      console.error(
        '[vitnode page-cache] `pageCache.storage` is "redis" but REDIS_URL is not set, so content writes cannot invalidate cached pages.',
      );
    } else {
      configurePageCacheStore(store, {
        maxLifetime: vitNodeApiConfig.pageCache.maxLifetime ?? 86_400,
      });
    }
  }

  const plugins = [newBuildPluginApiCore, ...vitNodeApiConfig.plugins];

  assertPluginContentModules({
    loader: vitNodeApiConfig.contentModules
      ? generatedContentModules(vitNodeApiConfig.contentModules)
      : packageContentModules(),
    plugins,
  });

  setDefaultBlockRegistry(
    createBlockRegistry(plugins.flatMap(plugin => plugin.blocks ?? [])),
  );

  // The generated document names every route, parameter and response shape in
  // the install, including the admin tree - a map of the attack surface, handed
  // out unauthenticated. Published in development, where it is the point, and
  // in production only when an install asks for it via `docs: { enabled: true }`.
  const docsEnabled = vitNodeApiConfig.docs?.enabled ?? CONFIG.node_development;

  if (docsEnabled) {
    // `app.doc` regenerates the whole document - every route's schema - on each
    // request. The routes are fixed once the plugins are mounted, so it is built
    // on the first request (the plugins mount below, after this line) and the
    // serialized JSON is served from then on.
    let openApiJson: string | undefined;
    app.get("/swagger/doc", c => {
      try {
        openApiJson ??= JSON.stringify(
          app.getOpenAPIDocument({
            openapi: "3.0.0",
            info: {
              version: manifest.version,
              title: "VitNode API",
            },
            tags: plugins.flatMap(
              plugin => plugin.openApiTags?.map(name => ({ name })) ?? [],
            ),
          }),
        );

        return c.body(openApiJson, 200, {
          "Content-Type": "application/json",
        });
      } catch (error) {
        return c.json({ error: describeError(error) }, 500);
      }
    });
  }

  const webOrigin = CONFIG.web.origin;
  const rateLimiter = rateLimiterMiddleware(vitNodeApiConfig.rateLimiter, {
    sessionCookieName:
      vitNodeApiConfig.authorization?.cookieName ?? DEFAULT_SESSION_COOKIE_NAME,
    storeClient: redisClient,
  });
  const corsConfig = corsOptions ?? { credentials: true, origin: webOrigin };

  app.use(
    secureHeaders({
      crossOriginResourcePolicy: false,
      referrerPolicy: "strict-origin-when-cross-origin",
      strictTransportSecurity: false,
    }),
  );
  app.use("*", clientIpMiddleware);
  app.use("*", rateLimiter.preflight);
  app.use(
    cors({
      ...corsConfig,
      exposeHeaders: exposeRateLimitHeaders(corsConfig.exposeHeaders),
    }),
  );
  app.use(
    csrf(
      csrfOptions ?? {
        origin: (origin, c) =>
          origin === webOrigin || origin === new URL(c.req.url).origin,
      },
    ),
  );
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
  app.use("*", rateLimiter.requests);
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
      frontendPlugins: vitNodeApiConfig.frontendPlugins,
      notifications: vitNodeApiConfig.notifications,
      ogImages: vitNodeApiConfig.ogImages,
      search: vitNodeApiConfig.search,
      storage: vitNodeApiConfig.storage,
      updates: vitNodeApiConfig.updates,
      users: vitNodeApiConfig.users,
      plugins,
      cacheClient: redisClient,
    }),
  );
  app.use("*", rateLimiter.identified);
  app.use(async (c, next) => {
    if (c.req.path.includes("/admin/")) {
      return await globalAdminMiddleware()(c, next);
    }

    return next();
  });

  const { cron } = vitNodeApiConfig;
  if (cron) {
    // Once per process: a rebuilt API must not add a second schedule.
    processSingleton("cron:schedule", () => {
      cron.schedule();

      return true;
    });
  }

  plugins.map(root => {
    app.route(`/${root.pluginId}`, root.hono);
  });

  registerCronJobs(vitNodeApiConfig.dbProvider, collectCronJobs(plugins)).catch(
    (error: unknown) => {
      // oxlint-disable-next-line no-console
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
