"use client";

import React from "react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";

const StaffPermissionContext = React.createContext<StaffPermissionSet>({
  root: false,
  permissions: [],
});

export const StaffPermissionProvider = ({
  value,
  children,
}: {
  children: React.ReactNode;
  value: StaffPermissionSet;
}) => (
  <StaffPermissionContext.Provider value={value}>
    {children}
  </StaffPermissionContext.Provider>
);

export const useStaffPermissions = (): StaffPermissionSet =>
  React.use(StaffPermissionContext);

export const useStaffPermission = (args: PermissionsStaffArgs): boolean => {
  const set = useStaffPermissions();

  return hasStaffPermission(set, args);
};

export const StaffPermissionGate = ({
  plugin,
  module,
  permission,
  children,
  fallback = null,
}: PermissionsStaffArgs & {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  const allowed = useStaffPermission({ plugin, module, permission });

  return <>{allowed ? children : fallback}</>;
};
