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
      200: {
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
        200: {
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
