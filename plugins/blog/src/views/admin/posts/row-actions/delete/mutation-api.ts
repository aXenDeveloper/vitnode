'use server';

import { fetcher } from '@vitnode/core/lib/fetcher';
import { revalidatePath } from 'next/cache';

import { postsModule } from '../../../../../api/modules/posts/posts.module';

export const mutationApi = async (id: number) => {
  const res = await fetcher(postsModule, {
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
