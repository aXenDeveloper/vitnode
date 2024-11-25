'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

export const mutationApi = async (body: ShowAuthSettingsAdminObj) => {
  await fetcher<ShowAuthSettingsAdminObj, ShowAuthSettingsAdminObj>({
    url: '/admin/settings/auth',
    method: 'POST',
    body,
  });
  revalidatePath('/', 'layout');
};
