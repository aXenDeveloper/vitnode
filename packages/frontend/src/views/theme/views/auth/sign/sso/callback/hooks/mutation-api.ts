'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';
import { redirect } from '@/navigation';
import { cookies } from 'next/headers';
import {
  RegisterSSOCallbackAuthBody,
  SSOCallbackAuthObj,
} from 'vitnode-shared/auth/sso.dto';

export const mutationApi = async ({
  provider,
  ...body
}: RegisterSSOCallbackAuthBody & {
  provider: string;
}) => {
  try {
    await fetcher<SSOCallbackAuthObj, RegisterSSOCallbackAuthBody>({
      method: 'POST',
      url: `/core/auth/sso/${provider}/register`,
      body,
    });

    const cookie = await cookies();
    const userIdFromCookie = cookie.get('vitnode-user-id')?.value;
    if (userIdFromCookie) {
      revalidateTags.session(+userIdFromCookie);
    }
    await redirect('/');
  } catch (err) {
    const { message } = err as Error;
    if (message === 'NEXT_REDIRECT') {
      await redirect('/');
    }
    if (message.includes('NAME_ALREADY_EXISTS')) {
      return { message: 'NAME_ALREADY_EXISTS' };
    }

    return { message: 'INTERNAL_SERVER_ERROR' };
  }
};
