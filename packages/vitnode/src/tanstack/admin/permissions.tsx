import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  AdminStaffPermissionGate,
  AdminStaffPermissionProvider,
  useAdminStaffPermission,
  useAdminStaffPermissions,
} from "@/components/staff-permission/provider";

import type { AdminAccessState, AdminSessionApi } from "./session-api";

import { useAdminSessionQuery } from "./session-query";
import { adminPermissionsOf, hasAdminPermission } from "./state";

/** Provides the signed-in admin's staff permissions to the hooks below. Mounted by the AdminCP shell. */
export const AdminPermissionsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data } = useAdminSessionQuery();

  return (
    <AdminStaffPermissionProvider value={adminPermissionsOf(data)}>
      {children}
    </AdminStaffPermissionProvider>
  );
};

/** The AdminCP access state: granted with a session, or why not. Suspends until known. */
export const useAdminAccess = (): AdminAccessState =>
  useAdminSessionQuery().data;

/** The signed-in admin, or `null` when access is not granted. */
export const useAdminUser = (): AdminSessionApi["user"] | null => {
  const access = useAdminAccess();

  return access.status === "granted" ? access.session.user : null;
};

/** Every staff permission the signed-in admin holds, inside the AdminCP shell. */
export const useAdminPermissions: () => StaffPermissionSet =
  useAdminStaffPermissions;

/**
 * Whether the signed-in admin holds one permission - for hiding a button or a
 * tab. UI only: the API route must still check it with `adminStaffPermission`.
 *
 * @example
 * ```tsx
 * import { useAdminPermission } from "@vitnode/core/tanstack/admin";
 *
 * const canDelete = useAdminPermission({ plugin: "@vitnode/blog", module: "posts", permission: "can_delete" });
 * ```
 */
export const useAdminPermission: (args: PermissionsStaffArgs) => boolean =
  useAdminStaffPermission;

export { AdminStaffPermissionGate as AdminPermissionGate };

export { hasAdminPermission };
