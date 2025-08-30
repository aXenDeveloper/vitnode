import { swaggerUI } from "@hono/swagger-ui";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env, Schema } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { newBuildPluginApiCore } from "@/api/plugin";
import { CONFIG_PLUGIN } from "@/config";
import type { VitNodeApiConfig } from "@/vitnode.config";

import {
  globalAdminMiddleware,
  globalMiddleware,
} from "./middlewares/global.middleware";
import { rateLimiterMiddleware } from "./middlewares/rate-limiter.middleware";

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
  app.doc("/swagger/doc", {
    openapi: "3.0.0",
    info: {
      version: CONFIG_PLUGIN.version,
      title: "VitNode API",
    },
  });
  app.use(cors(corsOptions));
  app.use(csrf(csrfOptions));
  app.use("*", rateLimiterMiddleware(vitNodeApiConfig.rateLimiter));
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
      plugins: [newBuildPluginApiCore, ...vitNodeApiConfig.plugins],
    }),
  );
  app.use(async (c, next) => {
    if (c.req.path.includes("/admin/")) {
      return await globalAdminMiddleware()(c, next);
    }

    return next();
  });

  app.onError(async (error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    await c.get("log").error(`Unhandled error: ${error.message}`);

    return new Response(
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal Server Error",
      {
        status: 500,
      },
    );
  });

  [newBuildPluginApiCore, ...vitNodeApiConfig.plugins].map(root => {
    app.route(`/${root.pluginId}`, root.hono);
  });

  return app;
}
