import { z } from 'zod';

import { CONFIG_PLUGIN } from '@/config';
import { core_logs, coreLogsType } from '@/database/logs';

import { buildRoute } from '../../../../lib/route';
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from '../../../../lib/with-pagination';

export const logsDebugAdminRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'get',
    description: 'Get Admin Debug Logs',
    path: '/logs',
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(['asc', 'desc']).optional(),
        orderBy: z.enum(['type', 'createdAt', 'pluginId']).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              edges: z.array(
                z.object({
                  id: z.number(),
                  pluginId: z.string(),
                  type: z.enum(coreLogsType.enumValues),
                  content: z.string(),
                  createdAt: z.date(),
                  ipAddress: z.string(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: 'List of users',
      },
    },
  },
  handler: async c => {
    const query = c.req.valid('query');
    const data = await withPagination({
      params: {
        query,
      },
      primaryCursor: core_logs.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get('db')
          .select({
            id: core_logs.id,
            pluginId: core_logs.pluginId,
            type: core_logs.type,
            content: core_logs.content,
            createdAt: core_logs.createdAt,
            ipAddress: core_logs.ipAddress,
          })
          .from(core_logs)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_logs,
      orderBy: {
        column: query.orderBy ? core_logs[query.orderBy] : core_logs.createdAt,
        order: query.order ?? 'desc',
      },
      c,
    });

    return c.json(data);
  },
});
