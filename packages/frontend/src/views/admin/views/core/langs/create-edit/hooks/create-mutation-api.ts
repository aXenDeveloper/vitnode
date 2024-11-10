'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreateLanguagesAdminBody,
  LanguagesAdminObj,
} from 'vitnode-shared/admin/language.dto';

export const createMutationApi = async (body: CreateLanguagesAdminBody) => {
  await fetcher<LanguagesAdminObj, CreateLanguagesAdminBody>({
    url: '/admin/languages',
    method: 'POST',
    body,
  });
  revalidatePath('/', 'layout');
};
