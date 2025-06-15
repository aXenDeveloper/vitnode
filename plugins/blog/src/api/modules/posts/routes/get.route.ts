import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from '@vitnode/core/api/lib/with-pagination';
import { eq } from 'drizzle-orm';

import { CONFIG_PLUGIN } from '@/const';
import { blog_categories } from '@/database/categories';
import { blog_posts } from '@/database/posts';

export const zodPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  titleSeo: z.string(),
  content: z.string(),
  categoryId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: z.object({
    id: z.number(),
    title: z.string(),
    titleSeo: z.string(),
  }),
});

export const postsRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'get',
    path: '/',
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(['asc', 'desc']).optional(),
        orderBy: z.enum(['updatedAt', 'createdAt']).optional(),
        categoryId: z.string().transform(Number).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              edges: z.array(zodPostSchema),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: 'Posts retrieved successfully',
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
      primaryCursor: blog_posts.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get('db')
          .select({
            id: blog_posts.id,
            title: blog_posts.title,
            titleSeo: blog_posts.titleSeo,
            content: blog_posts.content,
            categoryId: blog_posts.categoryId,
            createdAt: blog_posts.createdAt,
            updatedAt: blog_posts.updatedAt,
            category: {
              id: blog_categories.id,
              title: blog_categories.title,
              titleSeo: blog_categories.titleSeo,
            },
          })
          .from(blog_posts)
          .innerJoin(
            blog_categories,
            eq(blog_posts.categoryId, blog_categories.id),
          )
          .where(
            query.categoryId
              ? eq(blog_posts.categoryId, query.categoryId)
              : where,
          )
          .orderBy(orderBy)
          .limit(limit),
      table: blog_posts,
      orderBy: {
        column: query.orderBy
          ? blog_posts[query.orderBy]
          : blog_posts.updatedAt,
        order: query.order ?? 'desc',
      },
    });

    return c.json(data);
  },
});
