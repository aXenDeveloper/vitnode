import { buildRoute } from '@/api/lib/route';
import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';
import { UserModel } from '@/api/models/user';
import { z } from 'zod';

export const signInRoute = buildRoute({
  route: {
    method: 'post',
    description: 'Sign in with email and password',
    path: '/sign_in',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              email: z.string().email().toLowerCase().openapi({
                example: 'test@test.com',
              }),
              password: z.string().openapi({
                example: 'Test123!',
              }),
              isAdmin: z.boolean().optional().openapi({
                example: false,
              }),
            }),
          },
        },
      },
    },
    responses: {
      403: {
        description: 'Access Denied',
      },
      201: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              token: z.string(),
            }),
          },
        },
        description: 'User signed in',
      },
    },
  },
  handler: async c => {
    const { password, isAdmin, email } = c.req.valid('json');
    const data = await new UserModel().signInWithPassword({ password, email });

    if (isAdmin) {
      const { token } = await new SessionAdminModel(c).createSessionByUserId(
        data.id,
      );

      return c.json({ id: data.id, token }, 201);
    }
    const { token } = await new SessionModel(c).createSessionByUserId(data.id);

    return c.json({ id: data.id, token }, 201);
  },
});
