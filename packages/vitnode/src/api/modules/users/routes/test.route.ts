import { render } from '@react-email/components';
import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { CONFIG_PLUGIN } from '@/config';
import DefaultTemplate from '@/emails/default-template';

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
      to: 'ithereplay@gmail.com',
      subject: 'Test Email',
      content: 'This is a test email',
    });

    // throw new Error('Test error');

    await c.get('log').warn('This is a test warn log');

    return c.text('test');
  },
});
