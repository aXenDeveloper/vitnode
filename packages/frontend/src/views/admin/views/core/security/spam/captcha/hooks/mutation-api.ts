'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

export const mutationApi = async (body: ShowCaptchaSecurityAdminObj) => {
  await fetcher<ShowCaptchaSecurityAdminObj, ShowCaptchaSecurityAdminObj>({
    url: '/admin/security/captcha',
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
