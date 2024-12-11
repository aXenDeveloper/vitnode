import type { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from 'hono/logger';
import type { Env } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';

export const honoConfig = ({ app }: { app: OpenAPIHono<Env, {}, '/'> }) => {
  app.use('*', logger());
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
  });

  app.get('/ui', swaggerUI({ url: '/doc' }));
};
