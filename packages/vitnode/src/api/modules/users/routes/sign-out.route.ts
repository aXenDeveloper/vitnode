import { z } from '@hono/zod-openapi';

import { buildRoute } from '@/api/lib/route';
import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';

export const signOutRoute = buildRoute({
  plugin: '@vitnode/core',
  route: {
    method: 'delete',
    description: 'Sign out the current admin',
    path: '/sign_out',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              isAdmin: z.boolean().optional().openapi({
                example: false,
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'User signed out',
      },
      403: {
        description: 'Access Denied',
      },
    },
  },
  handler: async c => {
    const { isAdmin } = c.req.valid('json');
    if (isAdmin) {
      await new SessionAdminModel(c).deleteSession();

      return c.json({});
    }
    await new SessionModel(c).deleteSession();

    return c.json({});
  },
});
