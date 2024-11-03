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
}: { id: number } & EditLanguagesAdminBody) => {
  await fetcher<LanguagesAdminObj, EditLanguagesAdminBody>({
    url: `/admin/core/languages/${id}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
