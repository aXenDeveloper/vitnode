'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreatePluginsAdminBody,
  ShowPluginAdmin,
} from 'vitnode-shared/admin/plugins.dto';

import { checkConnectionApi } from '../../../check-connection-api';

export const mutationCreateApi = async (body: CreatePluginsAdminBody) => {
  await fetcher<ShowPluginAdmin, CreatePluginsAdminBody>({
    url: '/admin/plugins',
    method: 'POST',
    body,
  });

  await checkConnectionApi();

  revalidatePath('/', 'layout');
};
