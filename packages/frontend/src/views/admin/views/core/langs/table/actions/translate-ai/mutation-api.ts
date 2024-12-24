'use server';

import { fetcher } from '@/api/fetcher';
import { TranslateAiLanguagesAdminBody } from 'vitnode-shared/admin/language.dto';

export const mutationApi = async ({
  code,
  ...body
}: TranslateAiLanguagesAdminBody & {
  code: string;
}) => {
  await fetcher<object, TranslateAiLanguagesAdminBody>({
    url: `/admin/languages/translate-ai/${code}`,
    method: 'POST',
    body,
  });
};
