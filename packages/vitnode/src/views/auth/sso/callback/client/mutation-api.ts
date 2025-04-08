'use server';

import { UsersTypes } from '@/api/modules/users/users.module';
import { fetcher, handleSetCookiesFetcher } from '@/lib/fetcher';
import { revalidatePath } from 'next/cache';

export const mutationApi = async ({
  code,
  providerId,
  state,
}: {
  code: string;
  providerId: string;
  state: string;
}) => {
  const client = await fetcher<UsersTypes>({
    plugin: 'core',
    module: 'users',
  });

  const res = await client.sso[':providerId'].callback.$get({
    param: { providerId },
    query: {
      code,
      state,
    },
  });
  await handleSetCookiesFetcher(res);

  if (res.status !== 200) {
    return { error: 'Something went wrong' };
  }

  revalidatePath('/[locale]/(main)', 'layout');
};
