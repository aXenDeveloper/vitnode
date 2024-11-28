'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { CreatePermissionsAdminPluginsAdminBody } from 'vitnode-shared/admin/plugins/permissions-admin.dto';
import { PermissionsStaff } from 'vitnode-shared/admin/staff.dto';

export const editMutationApi = async ({
  plugin_code,
  old_id,
  ...body
}: CreatePermissionsAdminPluginsAdminBody & {
  old_id: string;
  plugin_code: string;
}) => {
  await fetcher<PermissionsStaff, CreatePermissionsAdminPluginsAdminBody>({
    url: `/admin/plugins/permissions-admin/${plugin_code}/${old_id}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
