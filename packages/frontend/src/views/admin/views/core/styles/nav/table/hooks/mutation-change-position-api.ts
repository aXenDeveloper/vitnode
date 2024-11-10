'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { ChangePositionNavStylesAdminBody } from 'vitnode-shared/admin/styles/nav.dto';

export const mutationChangePositionApi = async (
  body: ChangePositionNavStylesAdminBody,
) => {
  await fetcher<object, ChangePositionNavStylesAdminBody>({
    url: `/admin/styles/nav/change_position`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
