'use server';

import { fetcher } from '@/api/fetcher';
import { ChangeForgotPasswordAuthBody } from 'vitnode-shared/auth/auth.dto';

export const mutationApi = async (body: ChangeForgotPasswordAuthBody) => {
  await fetcher<object, ChangeForgotPasswordAuthBody>({
    url: '/core/auth/forgot_password/change',
    method: 'POST',
    body,
  });
};
