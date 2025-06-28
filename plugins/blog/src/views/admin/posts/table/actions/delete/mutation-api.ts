'use server';

import { fetcher } from '@vitnode/core/lib/fetcher';
import { revalidatePath } from 'next/cache';

import { postsAdminModule } from '@/api/modules/admin/posts/posts.admin.module';

export const mutationApi = async (id: number) => {
  const res = await fetcher(postsAdminModule, {
    prefixPath: '/admin',
    method: 'delete',
    path: '/{id}',
    module: 'posts',
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
    '/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/posts',
    'page',
  );
};
