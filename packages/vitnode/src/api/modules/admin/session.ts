import { createApiRoute } from '@/api/lib/route';
import { SessionAdminModel } from '@/api/models/session-admin';
import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

const route = createApiRoute({
  method: 'get',
  description: 'Verify admin session',
  plugin: 'core',
  path: '/',
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
              group_id: z.string(),
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
});

export const sessionAdminRoute = new OpenAPIHono().openapi(route, async c => {
  const user = await new SessionAdminModel(c).verifySession();

  return c.json({
    user,
  });
});
