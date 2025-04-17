import { createApiRoute } from '@/api/lib/route';
import { SessionModel } from '@/api/models/session';
import { SSOModel } from '@/api/models/sso';
import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

const route = createApiRoute({
  method: 'get',
  description: 'SSO Callback',
  plugin: 'core',
  path: '/{providerId}/callback',
  request: {
    params: z.object({
      providerId: z.string(),
    }),
    query: z.object({
      code: z.string(),
      state: z.string(),
    }),
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
      description: 'URL',
    },
  },
});

export const callbackRoute = new OpenAPIHono().openapi(route, async c => {
  const { providerId } = c.req.valid('param');
  const { code, state } = c.req.valid('query');
  const sso = await new SSOModel(c).callback({ providerId, code, state });
  const { token } = await new SessionModel(c).createSessionByUserId(sso.userId);

  return c.json({ id: sso.userId, token });
});
