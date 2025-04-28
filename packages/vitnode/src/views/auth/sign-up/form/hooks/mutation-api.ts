'use server';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';
import { z } from 'zod';

import { buildSignUpFormSchema } from './use-form';

export const mutationApi = async (
  input: z.infer<ReturnType<typeof buildSignUpFormSchema>>,
) => {
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
