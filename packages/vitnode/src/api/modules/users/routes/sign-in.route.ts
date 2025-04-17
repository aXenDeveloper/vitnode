import { createApiRoute } from '@/api/lib/route';
import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';
import { UserModel } from '@/api/models/user';
import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

const route = createApiRoute({
  method: 'post',
  description: 'Sign in with email and password',
  plugin: 'core',
  path: '/',
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
    200: {
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
    403: {
      description: 'Access Denied',
    },
  },
});

export const signInRoute = new OpenAPIHono().openapi(route, async c => {
  const { password, isAdmin, email } = c.req.valid('json');
  const data = await new UserModel().signInWithPassword({ password, email });

  if (isAdmin) {
    const { token } = await new SessionAdminModel(c).createSessionByUserId(
      data.id,
    );

    return c.json({ id: data.id, token });
  }
  const { token } = await new SessionModel(c).createSessionByUserId(data.id);

  return c.json({ id: data.id, token });
});
