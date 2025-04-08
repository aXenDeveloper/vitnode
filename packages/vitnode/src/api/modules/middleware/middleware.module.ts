import { createModuleApi } from '@/api/lib/module';
import { createApiRoute } from '@/api/lib/route';
import { EmailModel } from '@/api/models/email';
import { OpenAPIHono, z } from '@hono/zod-openapi';

import { middlewareRoute } from './route';

export const middlewareModule = createModuleApi({
  name: 'middleware',
  plugin: 'core',
  routes: new OpenAPIHono().route('/', middlewareRoute).openapi(
    createApiRoute({
      method: 'post',
      plugin: 'core',
      path: '/test',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.string(),
            },
          },
          description: 'test',
        },
      },
    }),
    async c => {
      const email = new EmailModel(c);
      await email.send({
        to: 'ithereplay@gmail.com',
        subject: 'test',
        html: 'test',
      });

      return c.json('Hello, world!');
    },
  ),
});

export type MiddlewareTypes = typeof middlewareModule;
