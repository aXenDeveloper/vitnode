import { buildRoute } from '@/api/lib/route';
import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';
import { z } from 'zod';

export const sessionRoute = buildRoute({
  route: {
    method: 'get',
    description: 'Verify session',
    path: '/session',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              user: z
                .object({
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
                  isAdmin: z.boolean(),
                })
                .nullable(),
            }),
          },
        },
        description: 'User',
      },
    },
  },
  handler: async c => {
    const user = await new SessionModel(c).verifySession();
    const admin = new SessionAdminModel(c);

    return c.json({
      user: user
        ? {
            ...user,
            isAdmin: await admin.checkIfUserIsAdmin(user.id),
          }
        : null,
    });
  },
});
