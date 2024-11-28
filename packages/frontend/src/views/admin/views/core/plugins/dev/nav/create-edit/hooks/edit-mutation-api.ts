'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';
import { CreateNavPluginsAdminBody } from 'vitnode-shared/admin/plugins/nav.dto';

export const editMutationApi = async ({
  plugin_code,
  previous_code,
  ...body
}: CreateNavPluginsAdminBody & {
  plugin_code: string;
  previous_code: string;
}) => {
  await fetcher<ParentNavAuthAdminObj, CreateNavPluginsAdminBody>({
    url: `/admin/plugins/nav/${plugin_code}/${previous_code}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/[locale]/admin/(auth)', 'layout');
};
