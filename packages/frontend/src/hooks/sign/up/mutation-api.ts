'use server';

import { fetcher } from '@/api/fetcher';
import { SignUpAuthBody } from 'vitnode-shared/auth/auth.dto';

export const mutationApi = async (
  body: {
    token: string;
  } & SignUpAuthBody,
) => {
  try {
    await fetcher<{ email: string }, SignUpAuthBody>({
      url: '/core/auth/sign_up',
      method: 'POST',
      body,
      headers: {
        'x-vitnode-captcha-token': body.token,
      },
    });
  } catch (err) {
    const { message } = err as Error;
    if (message.includes('CAPTCHA_FAILED')) {
      return { message: 'CAPTCHA_FAILED' };
    }

    if (message.includes('EMAIL_ALREADY_EXISTS')) {
      return { message: 'EMAIL_ALREADY_EXISTS' };
    }

    if (message.includes('NAME_ALREADY_EXISTS')) {
      return { message: 'NAME_ALREADY_EXISTS' };
    }

    return { message: 'INTERNAL_SERVER_ERROR' };
  }
};
