import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';

export const categoriesRoute = buildRoute({
  plugin: '@vitnode/blog',
  route: {
    method: 'get',
    path: '/',
    request: {
      query: z.object({
        test: z.string(),
      }),
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
  },
  handler: c => {
    return c.json({
      test: 'test',
    });
  },
});
