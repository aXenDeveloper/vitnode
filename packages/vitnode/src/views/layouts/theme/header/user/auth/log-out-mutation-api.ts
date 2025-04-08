'use server';

import { UsersTypes } from '@/api/modules/users/users.module';
import { fetcher, handleSetCookiesFetcher } from '@/lib/fetcher';
import { redirect } from '@/lib/navigation';
import { revalidatePath } from 'next/cache';

export const logOutMutationApi = async ({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) => {
  const res = await fetcher<UsersTypes>({
    plugin: 'core',
    module: 'users',
  });

  const data = await res.sign_out.$delete({
    json: { isAdmin },
  });
  if (data.status === 200) {
    await handleSetCookiesFetcher(data);

    if (isAdmin) {
      revalidatePath('/admin/(main)', 'layout');
      await redirect('/admin');

      return;
    }
    revalidatePath('/[locale]/(main)', 'layout');
    await redirect('/');
  }
};
