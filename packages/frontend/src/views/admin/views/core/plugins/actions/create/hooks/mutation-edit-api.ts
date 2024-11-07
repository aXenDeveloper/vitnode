'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { EditPluginsAdminBody } from 'vitnode-shared/admin/plugin.dto';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

export const mutationEditApi = async ({
  code,
  ...body
}: { code: string } & EditPluginsAdminBody) => {
  await fetcher<ShowPluginAdmin, EditPluginsAdminBody>({
    url: `/admin/plugins/${code}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
