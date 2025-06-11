'use server';

import { fetcher } from '@vitnode/core/lib/fetcher';
import { revalidatePath } from 'next/cache';

import { categoriesModule } from '../../../../api/modules/categories/categories.module';

export const mutationApi = async (id: number) => {
  const res = await fetcher(categoriesModule, {
    method: 'delete',
    path: '/{id}',
    module: 'categories',
    args: {
      params: {
        id,
      },
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  revalidatePath(
    '/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/categories',
    'page',
  );
};
