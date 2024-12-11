import { databaseClient } from '@/utils/database/index.js';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { ParamsSchema, UserSchema } from 'vitnode-shared-api/middleware.dto';

export const core = new OpenAPIHono();

const test = async ({ id }: z.infer<typeof ParamsSchema>) => {
  const test = await databaseClient.db.query.core_languages.findMany({});
  console.log(test);

  console.log(id);
};

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'Retrieve the user',
    },
  },
});

core.openapi(route, async c => {
  const { id } = c.req.valid('param');

  await test({ id });

  return c.json({
    id,
    age: 20,
    name: 'Ultra-man',
  });
});
