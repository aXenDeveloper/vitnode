import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context, Env, Schema } from 'hono';

import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';

import type { VitNodeApiConfig, VitNodeConfig } from '@/vitnode.config';

import { newBuildPluginApiCore } from '@/api/plugin';

import { internalVitNodeConfig } from './internal-config';
import {
  globalAdminMiddleware,
  globalMiddleware,
} from './middlewares/global/global';

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
      version: internalVitNodeConfig.version,
      title: 'VitNode API',
    },
  });
  app.use(cors(corsOptions));
  app.use(csrf(csrfOptions));
  app.get('/swagger', swaggerUI({ url: `/api/swagger/doc` }));
  app.use(
    '*',
    globalMiddleware({
      emailProvider: vitNodeApiConfig.emailProvider,
      metadata: vitNodeConfig.metadata,
      authorization: vitNodeApiConfig.authorization,
      dbProvider: vitNodeApiConfig.dbProvider,
    }),
  );
  app.use(async (c, next) => {
    if (c.req.path.includes('/admin/')) {
      return globalAdminMiddleware()(c, next);
    }

    return next();
  });

  app.onError(error => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    // eslint-disable-next-line no-console
    console.error(error);

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
    app.route(`/${root.name}`, root.hono);
  });

  return app;
}
