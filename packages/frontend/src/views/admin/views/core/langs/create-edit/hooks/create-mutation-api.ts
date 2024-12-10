'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreateLanguagesAdminBody,
  LanguagesAdminObj,
} from 'vitnode-shared/admin/language.dto';

export const createMutationApi = async (body: CreateLanguagesAdminBody) => {
  try {
    await fetcher<LanguagesAdminObj, CreateLanguagesAdminBody>({
      url: '/admin/languages',
      method: 'POST',
      body,
    });
    revalidatePath('/', 'layout');
  } catch (err) {
    const { message } = err as Error;

    if (message.includes('ALREADY_EXISTS')) {
      return { message: 'ALREADY_EXISTS' };
    }
  }
};
