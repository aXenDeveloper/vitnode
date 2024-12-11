import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

new OpenAPIHono();

export const ShowMiddlewareObj = z.object({});

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(3)
    .openapi({
      param: {
        name: 'id',
        in: 'path',
      },
      example: '1212121',
    }),
});

export const UserSchema = z.object({
  id: z.string().openapi({
    example: '123',
  }),
  name: z.string().openapi({
    example: 'John Doe',
  }),
  age: z.number().openapi({
    example: 42,
  }),
});
