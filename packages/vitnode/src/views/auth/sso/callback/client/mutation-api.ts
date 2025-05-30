'use server';

import { revalidatePath } from 'next/cache';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';

export const mutationApi = async ({
  code,
  providerId,
  state,
}: {
  code: string;
  providerId: string;
  state: string;
}) => {
  const res = await fetcher(usersModule, {
    path: '/{providerId}/callback',
    method: 'get',
    module: 'users/sso',
    allowSaveCookies: true,
    args: {
      params: {
        providerId,
      },
      query: {
        code,
        state,
      },
    },
  });

  if (res.status !== 200) {
    return { error: 'Something went wrong' };
  }

  revalidatePath('/[locale]/(main)', 'layout');
};
