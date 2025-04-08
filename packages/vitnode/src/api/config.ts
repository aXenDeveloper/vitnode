import corePlugin from '@/api/plugin';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context, Env, Schema } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';

import { PluginAPI } from './lib/plugin';
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

export function VitNodeAPI<T extends Schema>({
  app,
  cors: corsOptions,
  csrf: csrfOptions,
  plugins,
  ...options
}: Parameters<typeof globalMiddleware>[0] & {
  app: OpenAPIHono<Env, Schema, string>;
  cors?: CORSOptions;
  csrf?: CSRFOptions;
  plugins: PluginAPI<T, string>[];
}) {
  app.doc('/swagger/doc', {
    openapi: '3.0.0',
    info: {
      version: '0.2.0',
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

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(error);

      return new Response(error.message, {
        status: 500,
      });
    }

    return new Response('Internal Server Error', {
      status: 500,
    });
  });

  [corePlugin, ...plugins].map(root => {
    app.route(`/${root.name}`, root.app);
  });

  return app;
}
