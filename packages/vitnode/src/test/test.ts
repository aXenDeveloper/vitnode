import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { hc } from 'hono/client';

import { fetcher } from './testtest';

const test1 = new OpenAPIHono().openapi(
  createRoute({
    path: '/test123/:test',
    method: 'get',
    request: {
      params: z.object({
        test: z.string(),
      }),
    },
    responses: {
      201: {
        description: 'test',
        content: {
          'text/plain': {
            schema: z.string(),
          },
        },
      },
      403: {
        description: 'test',
        content: {
          'text/plain': {
            schema: z.string(),
          },
        },
      },
    },
  }),
  c => {
    return c.text('123');
  },
);

export const test = new OpenAPIHono()
  .openapi(
    createRoute({
      path: '/test',
      method: 'get',
      request: {
        query: z.object({
          test: z.string(),
        }),
      },
      responses: {
        201: {
          description: 'test',
          content: {
            'application/json': {
              schema: z.object({
                test: z.string(),
              }),
            },
          },
        },
        403: {
          description: 'test',
          content: {
            'application/json': {
              schema: z.object({
                test: z.string(),
              }),
            },
          },
        },
      },
    }),
    c => {
      return c.json({ test: 'test' });
    },
  )
  .route('/something', test1);

const client = hc<typeof test>('http://localhost:3000/api/core/test');

const test12 = await client.test.$get({
  query: {
    test: '123',
  },
});

const elo = await test12.json();

// eslint-disable-next-line no-console
console.log(elo.test);

const test124 = await client.something.test123[':test'].$get({
  param: {
    test: '123',
  },
});
