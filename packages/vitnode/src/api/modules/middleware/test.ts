import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { core_test } from '@/database/test';

import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from '../../lib/with-pagination';

export const routeTestMiddleware = buildRoute({
  plugin: '@vitnode/core',
  route: {
    path: '/test',
    method: 'get',
    description: 'Testing',
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(['asc', 'desc']).optional(),
        orderBy: z.enum(['id', 'createdAt']).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              edges: z.array(z.object({ id: z.number(), createdAt: z.date() })),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: 'Middleware route',
      },
    },
  },
  handler: async c => {
    const query = c.req.valid('query');
    const data = await withPagination({
      params: {
        query,
      },
      primaryCursor: core_test.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get('db')
          .select()
          .from(core_test)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_test,
      orderBy: {
        column: query.orderBy ? core_test[query.orderBy] : core_test.createdAt,
        order: query.order ?? 'desc',
      },
      c,
    });

    return c.json(data);
  },
});
