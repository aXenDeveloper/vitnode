import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';

import { CONFIG_PLUGIN } from '@/config';

export const categoriesRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
    path: '/',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().openapi({
                description: 'Name of the category',
                example: 'New Category',
              }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              name: z.string(),
            }),
          },
        },
        description: 'Category created successfully',
      },
    },
  },
  handler: c => {
    const { name } = c.req.valid('json');

    // Simulate category creation
    const newCategory = {
      id: 'new-id',
      name,
    };

    return c.json(newCategory, 201);
  },
});
