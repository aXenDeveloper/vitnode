import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ShowMiddlewareObj } from 'vitnode-shared-api/core/middleware.dto';

export const show = new OpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ShowMiddlewareObj,
        },
      },
      description: 'Show middleware',
    },
  },
});

show.openapi(route, async c => {
  const json: z.infer<typeof ShowMiddlewareObj> = {
    is_ai_enabled: false,
    is_email_enabled: false,
    languages_code_default: 'en',
    last_updated: new Date(),
    plugins: ['core', 'admin'],
    plugin_code_default: 'core',
  };

  return c.json(json);
});
