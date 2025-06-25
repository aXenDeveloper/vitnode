'use server';

import { fetcher } from '@vitnode/core/lib/fetcher';
import { revalidatePath } from 'next/cache';

import { categoriesAdminModule } from '@/api/modules/admin/categories/categories.admin.module';

export const mutationApi = async (id: number) => {
  const res = await fetcher(categoriesAdminModule, {
    prefixPath: '/admin',
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
