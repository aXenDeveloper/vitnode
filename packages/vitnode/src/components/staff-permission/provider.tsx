import React from "react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  EMPTY_STAFF_PERMISSION_SET,
  hasStaffPermission,
} from "@/api/lib/staff-permission";

const AdminStaffPermissionContext = React.createContext<
  Promise<StaffPermissionSet> | StaffPermissionSet
>(EMPTY_STAFF_PERMISSION_SET);

export const AdminStaffPermissionProvider = ({
  value,
  children,
}: {
  children: React.ReactNode;
  value: Promise<StaffPermissionSet> | StaffPermissionSet;
}) => (
  <AdminStaffPermissionContext.Provider value={value}>
    {children}
  </AdminStaffPermissionContext.Provider>
);

const isPending = (
  value: Promise<StaffPermissionSet> | StaffPermissionSet,
): value is Promise<StaffPermissionSet> =>
  typeof (value as Partial<Promise<StaffPermissionSet>>).then === "function";

/**
 * The current admin's staff permission set from the AdminCP layout. Suspends
 * while it loads. For hiding UI only - the API enforces permissions itself.
 */
export const useAdminStaffPermissions = (): StaffPermissionSet => {
  const value = React.use(AdminStaffPermissionContext);

  return isPending(value) ? React.use(value) : value;
};

/** Returns whether the current admin holds a given permission. */
export const useAdminStaffPermission = (
  args: PermissionsStaffArgs,
): boolean => {
  const set = useAdminStaffPermissions();

  return hasStaffPermission(set, args);
};

const AdminStaffPermissionGateResolved = ({
  plugin,
  module,
  permission,
  children,
  fallback,
}: PermissionsStaffArgs & {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) => {
  const allowed = useAdminStaffPermission({ plugin, module, permission });

  return <>{allowed ? children : fallback}</>;
};

/**
 * Renders `children` only when the current admin holds the permission,
 * otherwise `fallback` (also shown while permissions load). UI only - guard
 * the matching API route with `adminStaffPermission` as well.
 *
 * @example
 * ```tsx
 * <AdminStaffPermissionGate plugin="@vitnode/blog" module="posts" permission="can_delete">
 *   <DeletePostButton />
 * </AdminStaffPermissionGate>
 * ```
 */
export const AdminStaffPermissionGate = ({
  children,
  fallback = null,
  ...args
}: PermissionsStaffArgs & {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => (
  <React.Suspense fallback={fallback}>
    <AdminStaffPermissionGateResolved fallback={fallback} {...args}>
      {children}
    </AdminStaffPermissionGateResolved>
  </React.Suspense>
);
