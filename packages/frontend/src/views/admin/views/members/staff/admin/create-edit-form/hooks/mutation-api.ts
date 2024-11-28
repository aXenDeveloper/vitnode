'use server';

import { fetcher } from '@/api/fetcher';
import { revalidatePath } from 'next/cache';
import {
  AdminStaffMembersAdmin,
  CreateAdminStaffMembersAdminBody,
  EditAdminStaffMembersAdminBody,
} from 'vitnode-shared/admin/members/staff/admin.dto';

export const createMutationApi = async (
  body: CreateAdminStaffMembersAdminBody,
) => {
  await fetcher<AdminStaffMembersAdmin, CreateAdminStaffMembersAdminBody>({
    url: '/admin/members/staff/admin',
    method: 'POST',
    body,
  });

  revalidatePath('/', 'layout');
};

export const editMutationApi = async ({
  id,
  ...body
}: EditAdminStaffMembersAdminBody & { id: number }) => {
  await fetcher<AdminStaffMembersAdmin, EditAdminStaffMembersAdminBody>({
    url: `/admin/members/staff/admin/${id}`,
    method: 'PUT',
    body,
  });

  revalidatePath('/', 'layout');
};
