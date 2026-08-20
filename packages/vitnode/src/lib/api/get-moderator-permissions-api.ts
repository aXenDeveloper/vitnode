import { cache } from "react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

/**
 * The visitor's effective moderator permissions on the public site.
 *
 * Memoised per render pass for the same reason
 * [the admin session](./get-session-admin-api.ts) is: a page gates several
 * elements on several different permissions, and every
 * {@link checkModeratorPermissionApi} call resolves the whole set. One render
 * pass makes one request whatever it asks about.
 */
export const getModeratorPermissionsApi = cache(
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
  },
);

export const checkModeratorPermissionApi = async (
  args: PermissionsStaffArgs,
): Promise<boolean> => {
  const set = await getModeratorPermissionsApi();

  return hasStaffPermission(set, args);
};
