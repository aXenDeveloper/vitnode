import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';

import { CONFIG_PLUGIN } from '@/config';
import { blog_categories } from '@/database/categories';

export const zodCreateCategorySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
});

const zodCategoryResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createCategoryRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
    path: '/',
    request: {
      body: {
        content: {
          'application/json': {
            schema: zodCreateCategorySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: zodCategoryResponseSchema,
          },
        },
        description: 'Category created successfully',
      },
      400: {
        description: 'Bad request - Invalid input data',
      },
    },
  },
  handler: async c => {
    const { title } = c.req.valid('json');

    const [category] = await c
      .get('db')
      .insert(blog_categories)
      .values({
        title,
      })
      .returning();

    return c.json(category, 201);
  },
});
