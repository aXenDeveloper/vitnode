import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';

export const honoConfig = ({ app }: { app: OpenAPIHono<Env, {}, '/'> }) => {
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
  });

  app.get('/ui', swaggerUI({ url: '/doc' }));
};
