import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { PasswordModel } from '@/api/models/password';
import { UserModel } from '@/api/models/user';
import { CONFIG_PLUGIN } from '@/config';

const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export const zodSignUpSchema = z.object({
  email: z.string().email().toLowerCase().openapi({
    example: 'test@test.com',
  }),
  name: z
    .string()
    .openapi({ example: 'test' })
    .min(3)
    .refine(val => nameRegex.test(val), {
      message: 'Invalid name',
    }),
  password: z.string().min(8).openapi({
    example: 'Test123!',
  }),
  newsletter: z.boolean().default(false).optional(),
});

export const signUpRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
    description: 'Create a new user',
    path: '/sign_up',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: zodSignUpSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.number(),
            }),
          },
        },
        description: 'User created',
      },
    },
  },
  handler: async c => {
    const hashedPassword = await new PasswordModel().encryptPassword(
      c.req.valid('json').password,
    );
    const data = await new UserModel().signUp(
      { ...c.req.valid('json'), hashedPassword },
      c,
    );

    return c.json({ id: data.id });
  },
});
