import { buildRoute } from '@/api/lib/route';
import { dbClient } from '@/database/client';
import { core_test } from '@/database/schema/test';
import { z } from 'zod';

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
        await dbClient
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
    });

    return c.json(data);
  },
});
