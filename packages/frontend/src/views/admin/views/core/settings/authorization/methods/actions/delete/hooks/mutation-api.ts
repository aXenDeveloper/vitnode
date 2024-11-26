'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';

export const mutationApi = async (code: string) => {
  await fetcher<object>({
    url: `/admin/settings/auth/methods/${code}`,
    method: 'DELETE',
  });

  revalidatePath('/', 'layout');
};
