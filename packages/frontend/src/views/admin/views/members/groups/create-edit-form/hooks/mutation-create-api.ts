'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  CreateGroupsMembersAdminBody,
  GroupMembersAdmin,
} from 'vitnode-shared/admin/members/groups.dto';

export const mutationCreateApi = async (body: CreateGroupsMembersAdminBody) => {
  await fetcher<GroupMembersAdmin, CreateGroupsMembersAdminBody>({
    url: '/admin/members/groups',
    method: 'POST',
    body,
  });

  revalidatePath('/', 'layout');
};
