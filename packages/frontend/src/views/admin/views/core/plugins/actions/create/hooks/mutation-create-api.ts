'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreatePluginsAdminBody,
  ShowPluginAdmin,
} from 'vitnode-shared/admin/plugins.dto';

export const mutationCreateApi = async (body: CreatePluginsAdminBody) => {
  await fetcher<ShowPluginAdmin, CreatePluginsAdminBody>({
    url: '/admin/plugins',
    method: 'POST',
    body,
  });

  revalidatePath('/', 'layout');
};
