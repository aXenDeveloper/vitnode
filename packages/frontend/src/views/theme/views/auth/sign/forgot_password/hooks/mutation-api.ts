'use server';

import { fetcher } from '@/api/fetcher';
import { SendForgotPasswordAuthBody } from 'vitnode-shared/auth/auth.dto';

export const mutationApi = async ({
  token,
  ...body
}: SendForgotPasswordAuthBody & { token: string }) => {
  await fetcher<object, SendForgotPasswordAuthBody>({
    url: '/core/auth/forgot_password/send',
    method: 'POST',
    body,
    headers: {
      'x-vitnode-captcha-token': token,
    },
  });
};
