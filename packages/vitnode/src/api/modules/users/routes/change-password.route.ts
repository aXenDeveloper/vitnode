import { and, eq, gt } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { PasswordModel } from '@/api/models/password';
import { CONFIG_PLUGIN } from '@/config';
import { core_users, core_users_forgot_password } from '@/database/users';

export const zodChangePasswordSchema = z.object({
  password: z.string().min(8).openapi({
    example: 'Test123!',
  }),
  userId: z.number().openapi({ example: 123456 }),
  token: z.string().openapi({ example: 'abcdefg12345' }),
});

export const changePasswordRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
    description: 'Change user password',
    path: '/change-password',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: zodChangePasswordSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Password changed',
      },
    },
  },
  handler: async c => {
    const { password, userId, token } = c.req.valid('json');

    const [user] = await c
      .get('db')
      .select()
      .from(core_users_forgot_password)
      .where(
        and(
          eq(core_users_forgot_password.userId, userId),
          eq(core_users_forgot_password.token, token),
          gt(core_users_forgot_password.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      throw new HTTPException(400, { message: 'Invalid token' });
    }

    const hashPassword = await new PasswordModel().encryptPassword(password);
    await Promise.all([
      c
        .get('db')
        .update(core_users)
        .set({ password: hashPassword })
        .where(eq(core_users.id, userId)),
      c
        .get('db')
        .delete(core_users_forgot_password)
        .where(eq(core_users_forgot_password.id, user.id)),
    ]);

    return c.text('Password changed', 201);
  },
});
