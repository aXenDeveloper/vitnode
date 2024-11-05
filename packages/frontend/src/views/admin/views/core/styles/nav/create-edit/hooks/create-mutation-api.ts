'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { CreateNavStylesAdminBody } from 'vitnode-shared/admin/styles/nav.dto';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

export const createMutationApi = async (body: CreateNavStylesAdminBody) => {
  await fetcher<ShowNavStyles, CreateNavStylesAdminBody>({
    url: '/admin/styles/nav',
    method: 'POST',
    body,
  });

  revalidatePath('/', 'layout');
};
