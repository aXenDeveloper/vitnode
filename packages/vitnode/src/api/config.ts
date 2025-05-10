import { newBuildPluginCore } from '@/api/plugin';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context, Env, Schema } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';

import { BuildPluginReturn } from '../lib/plugin';
import { internalVitNodeConfig } from './internal-config';
import { globalMiddleware } from './middlewares/global/global';

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
  plugins,
  ...options
}: Parameters<typeof globalMiddleware>[0] & {
  app: OpenAPIHono<Env, Schema, string>;
  cors?: CORSOptions;
  csrf?: CSRFOptions;
  plugins: BuildPluginReturn[];
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
  app.use('*', globalMiddleware(options));

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

  [newBuildPluginCore, ...plugins].map(root => {
    app.route(`/${root.name}`, root.hono);
  });

  return app;
}
