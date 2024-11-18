'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';
import { revalidatePath } from 'next/cache';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { Legal } from 'vitnode-shared/legal.dto';

export const editMutationApi = async ({
  id,
  prevCode,
  ...body
}: { id: number; prevCode: string } & CreateLegalSettingsAdminBody) => {
  await fetcher<Legal, CreateLegalSettingsAdminBody>({
    url: `/admin/settings/legal/${id}`,
    method: 'PUT',
    body,
  });

  revalidateTags.terms(body.code, prevCode);
  revalidatePath('/[locale]/admin/(auth)/[...slug]', 'page');
};
