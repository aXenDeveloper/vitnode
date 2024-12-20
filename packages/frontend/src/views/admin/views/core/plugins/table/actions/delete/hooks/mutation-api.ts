'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';

import { checkConnectionApi } from '../../../../check-connection-api';

export const mutationApi = async (id: number) => {
  await fetcher<object>({
    url: `/admin/plugins/${id}`,
    method: 'DELETE',
  });

  await checkConnectionApi();

  revalidatePath('/', 'layout');
};
