'use server';

import type { z } from 'zod';

import type { zodSignUpSchema } from '@/api/modules/users/routes/sign-up.route';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';

export const mutationApi = async (input: z.infer<typeof zodSignUpSchema>) => {
  const res = await fetcher(usersModule, {
    path: '/sign_up',
    method: 'post',
    module: 'users',
    args: {
      body: input,
    },
  });

  if (res.status !== 200) {
    return { message: await res.text() };
  }
};
