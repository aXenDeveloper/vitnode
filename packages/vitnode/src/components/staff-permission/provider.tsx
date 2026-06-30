"use client";

import React from "react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";

const AdminStaffPermissionContext = React.createContext<StaffPermissionSet>({
  root: false,
  permissions: [],
});

/**
 * Makes the current **admin's** effective permissions available to client
 * components. Rendered once near the top of the admin layout.
 */
export const AdminStaffPermissionProvider = ({
  value,
  children,
}: {
  children: React.ReactNode;
  value: StaffPermissionSet;
}) => (
  <AdminStaffPermissionContext.Provider value={value}>
    {children}
  </AdminStaffPermissionContext.Provider>
);

/** Returns the current admin's raw effective permission set. */
export const useAdminStaffPermissions = (): StaffPermissionSet =>
  React.use(AdminStaffPermissionContext);

/** Returns whether the current admin holds a given permission. */
export const useAdminStaffPermission = (
  args: PermissionsStaffArgs,
): boolean => {
  const set = useAdminStaffPermissions();

  return hasStaffPermission(set, args);
};

/**
 * Renders `children` only when the current admin holds the given permission,
 * otherwise `fallback` (defaults to nothing).
 */
export const AdminStaffPermissionGate = ({
  plugin,
  module,
  permission,
  children,
  fallback = null,
}: PermissionsStaffArgs & {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  const allowed = useAdminStaffPermission({ plugin, module, permission });

  return <>{allowed ? children : fallback}</>;
};
