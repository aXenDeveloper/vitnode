import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

export const listCategories = new OpenAPIHono().openapi(
  {
    method: 'get',
    description: 'Get categories',
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
  c => {
    return c.json({
      test: 'test',
    });
  },
);
