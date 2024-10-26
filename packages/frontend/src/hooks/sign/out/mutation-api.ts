'use server';

import { fetcher } from '@/api/fetcher';
import { getUserIdCookie } from '@/api/get-user-id-cookie';
import { revalidateTags } from '@/api/revalidate-tags';
import { redirect } from '@/navigation';

export const mutationApi = async () => {
  await fetcher({
    url: '/core/auth/sign_out',
    method: 'DELETE',
  });

  const userIdFromCookie = await getUserIdCookie();
  if (userIdFromCookie) {
    revalidateTags.session(+userIdFromCookie);
  }

  await redirect('/');
};
