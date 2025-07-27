import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { PasswordModel } from '@/api/models/password';
import { UserModel } from '@/api/models/user';
import { CONFIG_PLUGIN } from '@/config';

import { SessionModel } from '../../../models/session';

const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export const zodSignUpSchema = z.object({
  email: z.email().toLowerCase().openapi({
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
    withCaptcha: true,
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
      201: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.number(),
              emailVerified: z.boolean(),
              email: z.email(),
            }),
          },
        },
        description: 'User created',
      },
      400: {
        description: 'Bad Request',
      },
      409: {
        description: 'Email or name already exists',
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

    if (data.emailVerified) {
      await new SessionModel(c).createSessionByUserId(data.id);
    } else {
      // TODO: Send verification email
    }

    return c.json(
      {
        id: data.id,
        emailVerified: data.emailVerified,
        email: data.email,
      },
      201,
    );
  },
});
