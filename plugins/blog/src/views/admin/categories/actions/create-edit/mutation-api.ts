'use server';

import type { z } from 'zod';

import { fetcher } from '@vitnode/core/lib/fetcher';
import { revalidatePath } from 'next/cache';

import type { zodCreateCategorySchema } from '@/api/modules/categories/routes/create.route';

import { categoriesModule } from '@/api/modules/categories/categories.module';

export const createMutationApi = async (
  body: z.infer<typeof zodCreateCategorySchema>,
) => {
  const res = await fetcher(categoriesModule, {
    method: 'post',
    module: 'categories',
    path: '/',
    args: {
      body,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  revalidatePath(
    '/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/categories',
    'page',
  );
};

export const editMutationApi = async ({
  id,
  ...body
}: z.infer<typeof zodCreateCategorySchema> & { id: number }) => {
  const res = await fetcher(categoriesModule, {
    method: 'put',
    module: 'categories',
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
    '/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/categories',
    'page',
  );
};
