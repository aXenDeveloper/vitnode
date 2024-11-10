'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';

export const mutationApi = async (code: string) => {
  await fetcher({
    url: `/admin/settings/legal/${code}`,
    method: 'DELETE',
  });

  revalidateTags.terms(code);
};
