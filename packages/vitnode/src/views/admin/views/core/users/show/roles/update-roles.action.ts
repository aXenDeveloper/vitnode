"use server";

import { revalidatePath } from "next/cache";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

type UpdateRolesResult = { data: true } | { error: { status: number } };

export const updateUserRoles = async (
  id: number,
  input: { roleId: number; secondaryRoleIds: number[] },
): Promise<UpdateRolesResult> => {
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "patch",
    module: "admin/users",
    args: {
      params: { id: String(id) },
      body: input,
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: true };
};
