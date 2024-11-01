'use server';

import { fetcher } from '@/api/fetcher';
import { TestEmailSettingsAdminBody } from 'vitnode-shared/admin/settings/email.dto';

export const mutationApi = async (body: TestEmailSettingsAdminBody) => {
  await fetcher<object, TestEmailSettingsAdminBody>({
    url: '/admin/settings/email/test',
    method: 'POST',
    body,
  });
};
