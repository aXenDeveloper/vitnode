"use server";

import { revalidatePath } from "next/cache";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const deleteRole = async ({
  id,
  moveToRoleId,
}: {
  id: number;
  moveToRoleId?: number;
}): Promise<{ error?: { status: number } }> => {
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "delete",
    module: "admin/roles",
    args: {
      params: { id: String(id) },
      query:
        moveToRoleId !== undefined
          ? { moveToRoleId: String(moveToRoleId) }
          : {},
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return {};
};
