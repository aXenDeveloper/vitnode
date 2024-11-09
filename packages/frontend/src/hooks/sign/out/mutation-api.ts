'use server';

import { fetcher } from '@/api/fetcher';
import { getAdminIdCookie, getUserIdCookie } from '@/api/get-user-id-cookie';
import { revalidateTags } from '@/api/revalidate-tags';
import { redirect } from '@/navigation';
import { SignOutAuthBody } from 'vitnode-shared/auth/auth.dto';

export const mutationApi = async (body: SignOutAuthBody) => {
  await fetcher<object, SignOutAuthBody>({
    url: '/core/auth/sign_out',
    method: 'DELETE',
    body,
  });

  if (body.is_admin) {
    const adminIdFromCookie = await getAdminIdCookie();
    if (adminIdFromCookie) {
      revalidateTags.sessionAdmin(+adminIdFromCookie);
    }

    await redirect('/admin/');

    return;
  }

  const userIdFromCookie = await getUserIdCookie();
  if (userIdFromCookie) {
    revalidateTags.session(+userIdFromCookie);
  }

  await redirect('/');
};
