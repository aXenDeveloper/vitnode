import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from '@vitnode/core/api/lib/with-pagination';

import { CONFIG_PLUGIN } from '@/config';
import { blog_categories } from '@/database/categories';

const zodCategorySchema = z.object({
  id: z.number(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const categoriesRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'get',
    path: '/',
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(['asc', 'desc']).optional(),
        orderBy: z.enum(['updatedAt']).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              edges: z.array(zodCategorySchema),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: 'Categories retrieved successfully',
      },
    },
  },
  handler: async c => {
    const query = c.req.valid('query');

    const data = await withPagination({
      c,
      params: {
        query,
      },
      primaryCursor: blog_categories.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get('db')
          .select()
          .from(blog_categories)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: blog_categories,
      orderBy: {
        column: query.orderBy
          ? blog_categories[query.orderBy]
          : blog_categories.updatedAt,
        order: query.order ?? 'desc',
      },
    });

    return c.json(data);
  },
});
