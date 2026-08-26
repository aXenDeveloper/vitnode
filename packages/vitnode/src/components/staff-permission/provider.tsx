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
