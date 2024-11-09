'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { EditorStylesAdminBody } from 'vitnode-shared/admin/styles/editor.dto';

export const mutationApi = async (body: EditorStylesAdminBody) => {
  await fetcher<EditorStylesAdminBody, EditorStylesAdminBody>({
    url: '/admin/styles/editor',
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
