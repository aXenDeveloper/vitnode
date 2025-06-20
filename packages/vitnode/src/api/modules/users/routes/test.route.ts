import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { CONFIG_PLUGIN } from '@/config';
// import { EmailModel } from '../../../models/email';

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
    // await new EmailModel(c).send({
    //   html: '<p>Test email</p>',
    //   to: 'ithereplay@gmail.com',
    //   subject: 'Test Email',
    // });

    return c.text('test');
  },
});
