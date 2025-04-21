import { z } from '@hono/zod-openapi';
import { buildRoute } from 'vitnode/api/lib/route';

export const categoriesRoute = buildRoute({
  route: {
    method: 'get',
    path: '/',
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
