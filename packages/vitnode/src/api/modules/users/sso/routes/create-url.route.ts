import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { SSOModel } from '@/api/models/sso';
import { CONFIG_PLUGIN } from '@/config';

export const createUrlRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
    description: 'Generate SSO URL',
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
  },
  handler: async c => {
    const { providerId } = c.req.valid('param');
    const url = await new SSOModel(c).getUrl(providerId);

    return c.json({
      url,
    });
  },
});
