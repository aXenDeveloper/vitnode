"use server";

import { revalidatePath } from "next/cache";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const updateStaffPermissions = async ({
  type,
  id,
  unrestricted,
  permissions,
}: {
  id: string;
  permissions: PermissionsStaffArgs[];
  type: PermissionStaffType;
  unrestricted: boolean;
}): Promise<{ data?: true; error?: { status: number } }> => {
  const res = await fetcher(adminModule, {
    path: "/entry/{type}/{id}",
    method: "patch",
    module: "admin/staff",
    args: {
      params: { type, id },
      body: { unrestricted, permissions },
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: true };
};
