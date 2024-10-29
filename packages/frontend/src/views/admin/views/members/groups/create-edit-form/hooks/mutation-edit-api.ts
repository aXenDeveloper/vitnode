'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreateGroupsMembersAdminBody,
  GroupMembersAdmin,
} from 'vitnode-shared/admin/members/groups.dto';

export const mutationEditApi = async ({
  id,
  ...body
}: { id: number } & CreateGroupsMembersAdminBody) => {
  await fetcher<GroupMembersAdmin, CreateGroupsMembersAdminBody>({
    url: `/admin/members/groups/${id}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
