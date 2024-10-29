'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { SignUpAuthBody } from 'vitnode-shared/auth.dto';

export const mutationApi = async (
  body: {
    token: string;
  } & SignUpAuthBody,
) => {
  await fetcher<{ email: string }, SignUpAuthBody>({
    url: '/core/auth/sign_up',
    method: 'POST',
    body,
    headers: {
      'x-vitnode-captcha-token': body.token,
    },
  });

  revalidatePath('/[locale]/admin/(auth)/members/users', 'page');
};
