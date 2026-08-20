"use client";

import React from "react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";

const NO_PERMISSIONS: StaffPermissionSet = { root: false, permissions: [] };

const AdminStaffPermissionContext = React.createContext<
  Promise<StaffPermissionSet>
>(Promise.resolve(NO_PERMISSIONS));

/**
 * Makes the current **admin's** effective permissions available to client
 * components. Rendered once near the top of the admin layout.
 */
export const AdminStaffPermissionProvider = ({
  value,
  children,
}: {
  children: React.ReactNode;
  value: Promise<StaffPermissionSet>;
}) => (
  <AdminStaffPermissionContext.Provider value={value}>
    {children}
  </AdminStaffPermissionContext.Provider>
);

/** Returns the current admin's raw effective permission set. */
export const useAdminStaffPermissions = (): StaffPermissionSet =>
  React.use(React.use(AdminStaffPermissionContext));

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
 * Renders `children` only when the current admin holds the given permission,
 * otherwise `fallback` (defaults to nothing).
 *
 * `fallback` also covers the moment before the permission set has arrived, so
 * the gate is safe to use anywhere - including above a page's own boundary.
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
