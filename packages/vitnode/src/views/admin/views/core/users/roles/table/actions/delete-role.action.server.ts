"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { expireCachePath } from "@/framework/cache";
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

  expireCachePath("/[locale]/admin", "layout");

  return {};
};
