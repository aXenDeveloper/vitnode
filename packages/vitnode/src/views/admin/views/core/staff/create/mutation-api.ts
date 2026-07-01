"use server";

import { revalidatePath } from "next/cache";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const createStaffEntry = async ({
  type,
  roleId,
  userId,
}: {
  roleId?: number;
  type: PermissionStaffType;
  userId?: number;
}): Promise<{ data?: { id: number }; error?: { status: number } }> => {
  const res = await fetcher(adminModule, {
    path: "/entry/{type}",
    method: "post",
    module: "admin/staff",
    args: {
      params: { type },
      body: { roleId, userId },
    },
  });

  if (res.status !== 201) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: await res.json() };
};
