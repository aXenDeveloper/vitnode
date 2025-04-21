import { z } from '@hono/zod-openapi';

import { buildModule } from './module';
import { buildRoute } from './route';

export const test = buildModule({
  plugin: 'test_plugin',
  routes: [
    buildRoute({
      route: {
        path: '/test34',
        method: 'get',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      },
      handler: c => {
        return c.json({
          message: `Hello from ${c.req.path}`,
        });
      },
    }),
    buildRoute({
      route: {
        path: '/test2',
        method: 'post',
        request: {
          body: {
            required: true,
            content: {
              'application/json': {
                schema: z.object({
                  email: z.string().email().toLowerCase().openapi({
                    example: 'test@test.com',
                  }),
                  password: z.string().openapi({
                    example: 'Test123!',
                  }),
                  isAdmin: z.boolean().optional().openapi({
                    example: false,
                  }),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success 2',
            content: {
              'application/json': {
                schema: z.object({
                  message: z.string(),
                }),
              },
            },
          },
        },
      },
      handler: c => {
        const { isAdmin, email } = c.req.valid('json');

        return c.json({
          message: `Got request from ${email} with admin status: ${isAdmin ?? false}`,
        });
      },
    }),
  ],
});

export type Test = typeof test;
