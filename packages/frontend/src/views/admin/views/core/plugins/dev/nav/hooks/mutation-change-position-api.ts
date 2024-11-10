'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { ChangePositionNavPluginsAdminBody } from 'vitnode-shared/admin/plugins/nav.dto';

export const mutationChangePositionApi = async ({
  plugin_code,
  code,
  ...body
}: {
  code: string;
  plugin_code: string;
} & ChangePositionNavPluginsAdminBody) => {
  await fetcher<object, ChangePositionNavPluginsAdminBody>({
    url: `/admin/plugins/nav/change_position/${plugin_code}/${code}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/[locale]/admin/(auth)', 'layout');
};
