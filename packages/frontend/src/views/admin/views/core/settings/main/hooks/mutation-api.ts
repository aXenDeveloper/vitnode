'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { MainSettingsAdminBody } from 'vitnode-shared/admin/settings.dto';

export const mutationApi = async (body: MainSettingsAdminBody) => {
  await fetcher<MainSettingsAdminBody, MainSettingsAdminBody>({
    url: '/admin/settings/main',
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
