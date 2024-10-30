'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';
import { CreateLegalBody, Legal } from 'vitnode-shared/legal.dto';

export const createMutationApi = async (body: CreateLegalBody) => {
  await fetcher<Legal, CreateLegalBody>({
    url: '/admin/settings/legal',
    method: 'POST',
    body,
  });

  revalidateTags.terms(body.code);
};
