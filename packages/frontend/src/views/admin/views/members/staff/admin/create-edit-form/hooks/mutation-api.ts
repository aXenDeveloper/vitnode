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
  try {
    await fetcher<AdminStaffMembersAdmin, CreateAdminStaffMembersAdminBody>({
      url: '/admin/members/staff/admin',
      method: 'POST',
      body,
    });

    revalidatePath('/', 'layout');
  } catch (err) {
    const error = err as Error;

    if (error.message.includes('ALREADY_EXISTS')) {
      return { message: 'already_exists' };
    }

    throw err;
  }
};

export const editMutationApi = async ({
  id,
  ...body
}: EditAdminStaffMembersAdminBody & { id: number }) => {
  try {
    await fetcher<AdminStaffMembersAdmin, EditAdminStaffMembersAdminBody>({
      url: `/admin/members/staff/admin/${id}`,
      method: 'PUT',
      body,
    });

    revalidatePath('/', 'layout');
  } catch (err) {
    const error = err as Error;

    if (error.message.includes('ALREADY_EXISTS')) {
      return { message: 'already_exists' };
    }

    throw err;
  }
};
