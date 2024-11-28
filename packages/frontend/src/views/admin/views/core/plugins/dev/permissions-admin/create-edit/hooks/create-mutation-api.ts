'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { CreatePermissionsAdminPluginsAdminBody } from 'vitnode-shared/admin/plugins/permissions-admin.dto';
import { PermissionsStaff } from 'vitnode-shared/admin/staff.dto';

export const createMutationApi = async ({
  plugin_code,
  ...body
}: CreatePermissionsAdminPluginsAdminBody & {
  plugin_code: string;
}) => {
  await fetcher<PermissionsStaff, CreatePermissionsAdminPluginsAdminBody>({
    url: `/admin/plugins/permissions-admin/${plugin_code}`,
    method: 'POST',
    body,
  });

  revalidatePath('/', 'layout');
};
