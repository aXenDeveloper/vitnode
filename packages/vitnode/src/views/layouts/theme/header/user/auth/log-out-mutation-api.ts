'use server';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';
import { redirect } from '@/lib/navigation';
import { revalidatePath } from 'next/cache';

export const logOutMutationApi = async ({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) => {
  const res = await fetcher(usersModule, {
    path: '/sign_out',
    method: 'delete',
    allowSaveCookies: true,
    module: 'users',
    args: {
      body: { isAdmin },
    },
  });

  if (res.status === 200) {
    if (isAdmin) {
      revalidatePath('/admin/(main)', 'layout');
      await redirect('/admin');

      return;
    }
    revalidatePath('/[locale]/(main)', 'layout');
    await redirect('/');
  }
};
