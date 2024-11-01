'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { DeleteFilesQuery } from 'vitnode-shared/files.dto';

export const deleteMutationApi = async (query: DeleteFilesQuery) => {
  await fetcher<object, DeleteFilesQuery>({
    url: '/core/files',
    method: 'DELETE',
    query,
  });

  revalidatePath('/settings/files', 'page');
};
