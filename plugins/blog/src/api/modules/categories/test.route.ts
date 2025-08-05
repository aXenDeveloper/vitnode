import { buildRoute } from '@vitnode/core/api/lib/route';
import { z } from 'zod';

import { CONFIG_PLUGIN } from '@/const';
import TestTemplateEmail from '@/emails/test-template';

export const testRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
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
  handler: async c => {
    await c.get('email').send({
      to: 'axendeveloper@gmail.com',
      subject: 'Test Email',
      content: TestTemplateEmail,
    });

    await c.get('log').warn('This is a test warn log');

    return c.text('test');
  },
});
