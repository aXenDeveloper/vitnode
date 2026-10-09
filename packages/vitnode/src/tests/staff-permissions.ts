import type { Context } from "hono";

import type { CacheModel } from "@/api/lib/cache";
import type {
  PermissionsStaffArgs,
  PermissionStaffType,
  ResolvedStaffPermissionSet,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { writeStaffPermissions } from "@/api/lib/staff-permission-cache";

export const ROOT_STAFF_PERMISSIONS: ResolvedStaffPermissionSet = {
  permissions: [],
  root: true,
  staff: true,
};

export const grantStaffPermissions = async (
  cache: CacheModel,
  {
    permissions,
    type = "admin",
    userId,
  }: {
    permissions:
      | PermissionsStaffArgs[]
      | (StaffPermissionSet & { staff?: boolean });
    type?: PermissionStaffType;
    userId: number;
  },
): Promise<void> => {
  const context = {
    get: (key: string) => (key === "cache" ? cache : undefined),
  } as unknown as Context;

  await writeStaffPermissions(
    context,
    { type, userId },
    Array.isArray(permissions)
      ? { permissions, root: false, staff: true }
      : { staff: true, ...permissions },
  );
};
