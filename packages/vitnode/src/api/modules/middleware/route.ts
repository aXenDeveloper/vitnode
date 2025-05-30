import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { EmailModel } from '@/api/models/email';

export const routeMiddleware = buildRoute({
  plugin: '@vitnode/core',
  route: {
    path: '/',
    method: 'get',
    description: 'Middleware route with user authentication',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              sso: z.array(z.object({ id: z.string(), name: z.string() })),
              isEmail: z.boolean(),
            }),
          },
        },
        description: 'Middleware route',
      },
    },
  },
  handler: c => {
    const sso = c.get('core').authorization.ssoPlugins;
    const email = new EmailModel(c);

    return c.json({
      isEmail: email.isAvailable(),
      sso: sso.map(s => ({ id: s.id, name: s.name })),
    });
  },
});
