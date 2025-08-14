import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { buildRoute } from '@/api/lib/route';
import { ForgotPasswordTokenModel } from '@/api/models/password';
import { CONFIG_PLUGIN } from '@/config';
import { core_users, core_users_forgot_password } from '@/database/users';

export const resetPasswordRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'post',
    description: 'Request a password reset',
    path: '/reset_password',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              email: z.email().toLowerCase().openapi({
                example: 'test@test.com',
              }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Email sent',
      },
    },
  },
  handler: async c => {
    const RESPONSE_TEXT = c.text('Email sent', 201);
    const { email } = c.req.valid('json');
    const [findUser] = await c
      .get('db')
      .select({
        email: core_users.email,
        id: core_users.id,
        language: core_users.language,
      })
      .from(core_users)
      .where(eq(core_users.email, email))
      .limit(1);

    if (!findUser) {
      return RESPONSE_TEXT;
    }

    const hashToken = new ForgotPasswordTokenModel().generateResetToken();

    const [findLastRecord] = await c
      .get('db')
      .select()
      .from(core_users_forgot_password)
      .where(eq(core_users_forgot_password.userId, findUser.id))
      .limit(1);

    // If a record will be found with createdAt in the last 15 minutes, skip
    if (findLastRecord?.createdAt > new Date(Date.now() - 1000 * 60 * 15)) {
      return RESPONSE_TEXT;
    }

    const EXPIRES_AT = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    if (findLastRecord) {
      await c
        .get('db')
        .update(core_users_forgot_password)
        .set({
          createdAt: new Date(),
          expiresAt: EXPIRES_AT,
          token: hashToken,
          ipAddress: c.get('ipAddress'),
        });
    } else {
      await c
        .get('db')
        .insert(core_users_forgot_password)
        .values({
          token: hashToken,
          ipAddress: c.get('ipAddress'),
          userId: findUser.id,
          expiresAt: EXPIRES_AT,
        });
    }

    // Send email
    await c.get('email').send({
      user: findUser,
      content: () => `email123 - ${hashToken} - userId - ${findUser.id}`,
      subject: 'Reset Password',
    });

    return RESPONSE_TEXT;
  },
});
