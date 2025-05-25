import { buildRoute } from '@/api/lib/route';
import { z } from 'zod';

export const testRoute = buildRoute({
  plugin: 'vitnode',
  route: {
    method: 'get',
    description: 'Test route',
    path: '/test',
    responses: {
      200: {
        content: {
          'text/plain': {
            schema: z.string(),
          },
        },
        description: 'User',
      },
      201: {
        content: {
          'text/plain': {
            schema: z.string(),
          },
        },
        description: 'User',
      },
    },
  },
  handler: c => {
    return c.text('test');
  },
});
