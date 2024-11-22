'use server';

import { fetcher } from '@/api/fetcher';
import { revalidateTags } from '@/api/revalidate-tags';
import {
  EditUserMembersAdminBody,
  UserMembersAdmin,
} from 'vitnode-shared/admin/members/users.dto';

export const mutationApi = async ({
  id,
  ...body
}: { id: number } & EditUserMembersAdminBody) => {
  try {
    await fetcher<UserMembersAdmin, EditUserMembersAdminBody>({
      url: `/admin/members/users/${id}`,
      method: 'PUT',
      body,
    });

    revalidateTags.session(id);
    revalidateTags.sessionAdmin(id);
  } catch (err) {
    const { message } = err as Error;

    if (message.includes('EMAIL_ALREADY_EXISTS')) {
      return { message: 'EMAIL_ALREADY_EXISTS' };
    }

    return { message: 'INTERNAL_SERVER_ERROR' };
  }
};
