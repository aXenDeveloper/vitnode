'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreateMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
} from 'vitnode-shared/admin/settings/auth.dto';

export const mutationApi = async (body: CreateMethodAuthSettingsAdminBody) => {
  await fetcher<ShowMethodAuthSettingsAdmin, CreateMethodAuthSettingsAdminBody>(
    {
      url: '/admin/settings/auth/methods',
      method: 'POST',
      body,
    },
  );

  revalidatePath('/', 'layout');
};
