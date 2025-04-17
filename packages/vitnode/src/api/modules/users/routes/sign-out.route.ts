import { createApiRoute } from '@/api/lib/route';
import { SessionModel } from '@/api/models/session';
import { SessionAdminModel } from '@/api/models/session-admin';
import { OpenAPIHono, z } from '@hono/zod-openapi';

const route = createApiRoute({
  method: 'delete',
  description: 'Sign out the current admin',
  plugin: 'core',
  path: '/',
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
});

export const signOutRoute = new OpenAPIHono().openapi(route, async c => {
  const { isAdmin } = c.req.valid('json');
  if (isAdmin) {
    await new SessionAdminModel(c).deleteSession();

    return c.json({});
  }
  await new SessionModel(c).deleteSession();

  return c.json({});
});
