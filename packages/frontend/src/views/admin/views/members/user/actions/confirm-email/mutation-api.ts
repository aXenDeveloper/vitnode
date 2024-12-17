'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';

export const mutationApi = async (id: number) => {
  await fetcher({
    url: `/admin/members/users/confirm-email/${id}`,
  });
  revalidateTags.session(id);
  revalidateTags.sessionAdmin(id);
};
