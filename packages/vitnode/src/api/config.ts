import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context, Env, Schema } from 'hono';

import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';

import type { VitNodeApiConfig, VitNodeConfig } from '@/vitnode.config';

import { newBuildPluginApiCore } from '@/api/plugin';
import { CONFIG_PLUGIN } from '@/config';

import {
  globalAdminMiddleware,
  globalMiddleware,
} from './middlewares/global.middleware';
import { rateLimiterMiddleware } from './middlewares/rate-limiter.middleware';

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
  vitNodeConfig,
}: {
  app: OpenAPIHono<Env, Schema, string>;
  cors?: CORSOptions;
  csrf?: CSRFOptions;
  vitNodeApiConfig: VitNodeApiConfig;
  vitNodeConfig: VitNodeConfig;
}) {
  app.doc('/swagger/doc', {
    openapi: '3.0.0',
    info: {
      version: CONFIG_PLUGIN.version,
      title: 'VitNode API',
    },
  });
  app.use(cors(corsOptions));
  app.use(csrf(csrfOptions));
  app.use('*', rateLimiterMiddleware(vitNodeApiConfig.rateLimiter));
  app.get('/swagger', swaggerUI({ url: `/api/swagger/doc` }));
  app.use(
    '*',
    globalMiddleware({
      emailAdapter: vitNodeApiConfig.emailAdapter,
      metadata: vitNodeConfig.metadata,
      authorization: vitNodeApiConfig.authorization,
      dbProvider: vitNodeApiConfig.dbProvider,
      captcha: vitNodeApiConfig.captcha,
    }),
  );
  app.use(async (c, next) => {
    if (c.req.path.includes('/admin/')) {
      return globalAdminMiddleware()(c, next);
    }

    return next();
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    c.get('log').error(`Unhandled error: ${error.message}`);

    return new Response(
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal Server Error',
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
