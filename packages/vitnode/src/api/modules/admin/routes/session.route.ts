import { buildRoute } from '@/api/lib/route';
import { SessionAdminModel } from '@/api/models/session-admin';
import { z } from 'zod';

export const sessionAdminRoute = buildRoute({
  route: {
    method: 'get',
    description: 'Verify admin session',
    plugin: 'core',
    pluginConfig: {
      id: 'core',
      name: 'Core',
    },
    path: '/session',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                name: z.string(),
                name_code: z.string(),
                joined_at: z.date(),
                newsletter: z.boolean(),
                avatar_color: z.string(),
                email_verified: z.boolean(),
                role_id: z.string(),
                birthday: z.date().nullable(),
              }),
            }),
          },
        },
        description: 'User',
      },
      403: {
        description: 'Access Denied',
      },
    },
  },
  handler: async c => {
    const user = await new SessionAdminModel(c).verifySession();

    return c.json({
      user,
    });
  },
});
