'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  EditLanguagesAdminBody,
  LanguagesAdminObj,
} from 'vitnode-shared/admin/language.dto';

export const editMutationApi = async ({
  id,
  ...body
}: EditLanguagesAdminBody & { id: number }) => {
  await fetcher<LanguagesAdminObj, EditLanguagesAdminBody>({
    url: `/admin/languages/${id}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
