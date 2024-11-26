'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  EditMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
} from 'vitnode-shared/admin/settings/auth.dto';

export const editMutationApi = async ({
  code,
  ...body
}: {
  code: string;
} & EditMethodAuthSettingsAdminBody) => {
  await fetcher<ShowMethodAuthSettingsAdmin, EditMethodAuthSettingsAdminBody>({
    url: `/admin/settings/auth/methods/${code}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
