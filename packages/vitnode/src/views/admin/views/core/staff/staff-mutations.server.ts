"use server";

import { revalidatePath } from "next/cache";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/**
 * The three staff writes, as this application's Server Actions.
 *
 * The same three requests `staff-mutations.ts` makes from a browser. What only
 * exists here is `revalidatePath("/[locale]/admin", "layout")` - which is doing
 * more work than it looks: a staff entry *is* a permission grant, so the layout
 * it revalidates includes the sidebar and every gate rendered from the admin
 * session. The TanStack AdminCP gets the same effect from
 * `invalidateAfterStaffChange`, which invalidates the staff family *and* the
 * session entry.
 */

export const createStaffEntryAction = async ({
  roleId,
  type,
  userId,
}: {
  roleId?: number;
  type: PermissionStaffType;
  userId?: number;
}): Promise<AdminMutationResult<{ id: number }>> => {
  const res = await fetcher(adminModule, {
    args: { body: { roleId, userId }, params: { type } },
    method: "post",
    module: "admin/staff",
    path: "/entry/{type}",
  });

  if (res.status !== 201) {
    return { error: { status: res.status } };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};

export const updateStaffPermissionsAction = async ({
  id,
  permissions,
  type,
  unrestricted,
}: {
  id: string;
  permissions: PermissionsStaffArgs[];
  type: PermissionStaffType;
  unrestricted: boolean;
}): Promise<
  AdminMutationResult<{
    permissions: PermissionsStaffArgs[];
    unrestricted: boolean;
  }>
> => {
  const res = await fetcher(adminModule, {
    args: {
      body: { permissions, unrestricted },
      params: { id, type },
    },
    method: "patch",
    module: "admin/staff",
    path: "/entry/{type}/{id}",
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};

export const deleteStaffEntryAction = async ({
  id,
  type,
}: {
  id: number | string;
  type: PermissionStaffType;
}): Promise<AdminMutationResult<true>> => {
  const res = await fetcher(adminModule, {
    args: { params: { id: String(id), type } },
    method: "delete",
    module: "admin/staff",
    path: "/entry/{type}/{id}",
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: true };
};
