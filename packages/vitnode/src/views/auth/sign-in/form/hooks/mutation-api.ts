'use server';

import { UsersTypes } from '@/api/modules/users/users.module';
import { fetcher, FetcherInput, handleSetCookiesFetcher } from '@/lib/fetcher';
import { redirect } from '@/lib/navigation';
import { revalidatePath } from 'next/cache';

export const mutationApi = async (
  input: FetcherInput<UsersTypes, '/sign_in', 'post'>,
) => {
  const res = await fetcher<UsersTypes>({
    plugin: 'core',
    module: 'users',
  });

  const data = await res.sign_in.$post(input);
  if (data.status === 403) {
    return { message: 'access_denied' } as const;
  }

  if (data.status !== 200) {
    return { message: 'Internal Server Error' } as const;
  }

  await handleSetCookiesFetcher(data);
  if (input.json.isAdmin) {
    revalidatePath('/[locale]/admin', 'layout');
    await redirect('/admin/core');

    return;
  }
  revalidatePath('/[locale]/(main)', 'layout');
  await redirect('/');
};
