'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { DeletePermissionsAdminPluginsAdminBody } from 'vitnode-shared/admin/plugins/permissions-admin.dto';

export const mutationApi = async ({
  id,
  plugin_code,
  ...body
}: DeletePermissionsAdminPluginsAdminBody & {
  id: string;
  plugin_code: string;
}) => {
  await fetcher<object, DeletePermissionsAdminPluginsAdminBody>({
    url: `/admin/plugins/permissions-admin/${plugin_code}/${id}`,
    method: 'DELETE',
    body,
  });

  revalidatePath('/', 'layout');
};
