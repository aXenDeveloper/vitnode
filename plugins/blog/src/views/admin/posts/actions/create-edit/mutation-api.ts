'use server';

import type { z } from 'zod';

import { fetcher } from '@vitnode/core/lib/fetcher';
import { revalidatePath } from 'next/cache';

import type { zodCreatePostSchema } from '@/api/modules/posts/routes/create.route';

import { postsModule } from '@/api/modules/posts/posts.module';

export const createMutationApi = async (
  body: z.infer<typeof zodCreatePostSchema>,
) => {
  const res = await fetcher(postsModule, {
    method: 'post',
    module: 'posts',
    path: '/',
    args: {
      body,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  revalidatePath(
    '/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/posts',
    'page',
  );
};

export const editMutationApi = async ({
  id,
  ...body
}: z.infer<typeof zodCreatePostSchema> & { id: number }) => {
  const res = await fetcher(postsModule, {
    method: 'put',
    module: 'posts',
    path: '/{id}',
    args: {
      params: {
        id,
      },
      body,
    },
  });

  if (res.status !== 200) {
    return { error: await res.text() };
  }

  revalidatePath(
    '/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/posts',
    'page',
  );
};
