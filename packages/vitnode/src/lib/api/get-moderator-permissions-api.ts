import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const getModeratorPermissionsApi =
  async (): Promise<StaffPermissionSet> => {
    const res = await fetcher(usersModule, {
      path: "/permissions",
      method: "get",
      module: "users",
    });

    if (res.status !== 200) {
      return { root: false, permissions: [] };
    }

    return await res.json();
  };

export const checkModeratorPermissionApi = async (
  args: PermissionsStaffArgs,
): Promise<boolean> => {
  const set = await getModeratorPermissionsApi();

  return hasStaffPermission(set, args);
};
