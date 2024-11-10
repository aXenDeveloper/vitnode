'use server';

import { fetcher } from '@/api/fetcher';
import { getAdminIdCookie } from '@/api/get-user-id-cookie';
import { revalidateTags } from '@/api/revalidate-tags';
import { redirect } from '@/navigation';
import { cookies } from 'next/headers';
import { SignInAuthBody } from 'vitnode-shared/auth/auth.dto';

export const mutationApi = async (body: SignInAuthBody) => {
  await fetcher<object, SignInAuthBody>({
    method: 'POST',
    url: '/core/auth/sign_in',
    body,
  });

  const cookie = await cookies();
  if (body.admin) {
    const adminIdFromCookie = await getAdminIdCookie();
    if (adminIdFromCookie) {
      revalidateTags.sessionAdmin(+adminIdFromCookie);
    }

    await redirect('/admin/core/dashboard');

    return;
  }

  const userIdFromCookie = cookie.get('vitnode-user-id')?.value;
  if (userIdFromCookie) {
    revalidateTags.session(+userIdFromCookie);
  }

  await redirect('/');
};
