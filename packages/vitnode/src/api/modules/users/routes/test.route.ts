import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { CONFIG_PLUGIN } from '@/config';

export const testRoute = buildRoute({
  ...CONFIG_PLUGIN,
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
