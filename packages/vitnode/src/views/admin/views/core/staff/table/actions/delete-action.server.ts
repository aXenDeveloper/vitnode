"use server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { adminModule } from "@/api/modules/admin/admin.module";
import { expireCachePath } from "@/framework/cache";
import { fetcher } from "@/lib/fetcher";

export const deleteStaffEntry = async ({
  type,
  id,
}: {
  id: number;
  type: PermissionStaffType;
}): Promise<{ data?: true; error?: { status: number } }> => {
  const res = await fetcher(adminModule, {
    path: "/entry/{type}/{id}",
    method: "delete",
    module: "admin/staff",
    args: {
      params: { type, id: String(id) },
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  expireCachePath("/[locale]/admin", "layout");

  return { data: true };
};
