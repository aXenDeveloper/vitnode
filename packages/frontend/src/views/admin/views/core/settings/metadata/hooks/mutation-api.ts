'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  ShowMetadataAdminBody,
  ShowMetadataAdminObj,
} from 'vitnode-shared/admin/settings/metadata.dto';

export const mutationApi = async (body: ShowMetadataAdminBody) => {
  await fetcher<ShowMetadataAdminObj, ShowMetadataAdminBody>({
    url: '/admin/settings/metadata',
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
