'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';

export const mutationApi = async (id: number) => {
  await fetcher<object>({
    url: `/admin/styles/nav/${id}`,
    method: 'DELETE',
  });

  revalidatePath('/', 'layout');
};
