'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';

export const mutationApi = async (id: number) => {
  await fetcher({
    url: `/admin/members/groups/${id}`,
    method: 'DELETE',
  });

  revalidatePath('/', 'layout');
};
