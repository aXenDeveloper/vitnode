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
  route: {
    isAuth: true,
    path: '/test',
    method: 'get',
    description: 'Testing',
    request: {
      query: z.object(zodPaginationQuery),
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
    const data = await withPagination({
      params: {
        query: c.req.valid('query'),
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
        column: core_test.createdAt,
        order: 'desc',
      },
      // where: like(core_test.text, '%1%'),
    });

    return c.json(data);
  },
});
