'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';
import { revalidatePath } from 'next/cache';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { Legal } from 'vitnode-shared/legal.dto';

export const createMutationApi = async (body: CreateLegalSettingsAdminBody) => {
  await fetcher<Legal, CreateLegalSettingsAdminBody>({
    url: '/admin/settings/legal',
    method: 'POST',
    body,
  });

  revalidateTags.terms(body.code);
  revalidatePath('/[locale]/admin/(auth)/[...slug]', 'page');
};
