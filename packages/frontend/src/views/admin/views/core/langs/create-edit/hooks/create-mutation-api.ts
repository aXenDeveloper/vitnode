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

    if (message.includes('CANNOT_FIND_LANGUAGE_FILE_IN_PLUGIN')) {
      return { message: 'CANNOT_FIND_LANGUAGE_FILE_IN_PLUGIN' };
    }

    if (message.includes('ALREADY_EXISTS')) {
      return { message: 'ALREADY_EXISTS' };
    }
  }
};
