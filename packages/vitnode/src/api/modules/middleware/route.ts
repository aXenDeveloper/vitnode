import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { CONFIG_PLUGIN } from '@/config';

export const routeMiddleware = buildRoute({
  ...CONFIG_PLUGIN,
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
    const sso = c.get('core').authorization.ssoProviders;

    return c.json({
      isEmail: !!c.get('core').emailAdapter,
      sso: sso.map(s => ({ id: s.id, name: s.name })),
    });
  },
});
