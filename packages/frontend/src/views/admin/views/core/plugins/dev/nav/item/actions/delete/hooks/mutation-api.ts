'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { DeleteNavPluginsAdminBody } from 'vitnode-shared/admin/plugins/nav.dto';

export const mutationApi = async ({
  plugin_code,
  code,
  ...body
}: {
  code: string;
  plugin_code: string;
} & DeleteNavPluginsAdminBody) => {
  await fetcher<object, DeleteNavPluginsAdminBody>({
    url: `/admin/plugins/nav/${plugin_code}/${code}`,
    method: 'DELETE',
    body,
  });

  revalidatePath('/[locale]/admin/(auth)', 'layout');
};
