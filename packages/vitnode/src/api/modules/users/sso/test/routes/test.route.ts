import { buildRoute } from '@/api/lib/route';
import { z } from 'zod';

export const testRoute = buildRoute({
  route: {
    method: 'post',
    description: 'Test route',
    path: '/test',
    responses: {
      301: {
        description: 'Redirect',
      },
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
    return c.redirect('/', 301);
  },
});
