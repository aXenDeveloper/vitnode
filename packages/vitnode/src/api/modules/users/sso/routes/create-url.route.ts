import { createApiRoute } from '@/api/lib/route';
import { SSOModel } from '@/api/models/sso';
import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

const route = createApiRoute({
  method: 'post',
  description: 'Generate SSO URL',
  plugin: 'core',
  path: '/{providerId}',
  request: {
    params: z.object({
      providerId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ url: z.string() }),
        },
      },
      description: 'URL',
    },
  },
});

export const createUrlRoute = new OpenAPIHono().openapi(route, async c => {
  const { providerId } = c.req.valid('param');
  const url = await new SSOModel(c).getUrl(providerId);

  return c.json({
    url,
  });
});
