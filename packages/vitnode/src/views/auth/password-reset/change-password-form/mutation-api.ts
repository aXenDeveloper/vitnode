'use server';

import type z from 'zod';

import type { zodChangePasswordSchema } from '@/api/modules/users/routes/change-password.route';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';

export const mutationApi = async ({
  password,
  token,
  userId,
}: z.infer<typeof zodChangePasswordSchema>) => {
  const res = await fetcher(usersModule, {
    module: 'users',
    path: '/change-password',
    method: 'post',
    args: {
      body: { password, token, userId },
    },
  });

  if (res.status !== 201) {
    return { error: 'internal_server_error' };
  }
};
