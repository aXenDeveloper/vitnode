import { OpenAPIHono, z } from '@hono/zod-openapi';
import { createApiRoute } from 'vitnode/api/lib/route';

export const categoriesRoute = new OpenAPIHono().openapi(
  createApiRoute({
    method: 'get',
    path: '/',
    pluginConfig: {
      id: 'blog',
      name: 'Blog',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              test: z.string(),
            }),
          },
        },
        description: 'Test',
      },
    },
  }),
  c => {
    return c.json({
      test: 'test',
    });
  },
);
