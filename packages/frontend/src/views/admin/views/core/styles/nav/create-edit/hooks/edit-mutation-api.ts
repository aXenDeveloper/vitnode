'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { CreateNavStylesAdminBody } from 'vitnode-shared/admin/styles/nav.dto';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

export const editMutationApi = async ({
  id,
  ...body
}: CreateNavStylesAdminBody & { id: number }) => {
  await fetcher<ShowNavStyles, CreateNavStylesAdminBody>({
    url: `/admin/styles/nav/${id}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
