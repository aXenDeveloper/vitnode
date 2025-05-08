import { buildRoute } from '@/api/lib/route';
import { SessionAdminModel } from '@/api/models/session-admin';
import { z } from 'zod';

import { getPackageJson } from '../../../lib/get-pacakge-json';

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
                id: z.number(),
                email: z.string(),
                name: z.string(),
                nameCode: z.string(),
                createdAt: z.date(),
                newsletter: z.boolean(),
                avatarColor: z.string(),
                emailVerified: z.boolean(),
                roleId: z.number(),
                birthday: z.date().nullable(),
              }),
              vitnode_version: z.string(),
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
      vitnode_version: (await getPackageJson()).version,
    });
  },
});
