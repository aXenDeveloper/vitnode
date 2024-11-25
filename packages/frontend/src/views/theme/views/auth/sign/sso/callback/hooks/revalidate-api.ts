'use server';

import { revalidateTags } from '@/api/revalidate-tags';
import { cookies } from 'next/headers';

export const revalidateApi = async () => {
  const cookie = await cookies();
  const userIdFromCookie = cookie.get('vitnode-user-id')?.value;
  if (userIdFromCookie) {
    revalidateTags.session(+userIdFromCookie);
  }
};
