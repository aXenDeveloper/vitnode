"use client";

import React from "react";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  EMPTY_STAFF_PERMISSION_SET,
  hasStaffPermission,
} from "@/api/lib/staff-permission";

/**
 * The signed-in administrator's effective permission set, as the AdminCP's UI
 * reads it.
 *
 * One context, two frontends, and deliberately not two sources of truth. What
 * differs between them is only *when the answer is available*, which is why the
 * value is a union:
 *
 * - **Next.js** passes a `Promise`. `AdminLayout` hands `getAdminPermissions()`
 *   over unawaited on purpose - awaiting it in the layout would put the session
 *   read above `{children}` and hide every admin page's own header and skeleton
 *   behind this layout's placeholder on a full page load.
 * - **TanStack Start** passes the resolved set.
 *   `AdminPermissionsProvider` in `@vitnode/core/tanstack/admin` reads it out of
 *   the canonical `["vitnode", "admin-session"]` query, which the `_admin`
 *   guard has already filled before anything renders - so there is nothing left
 *   to await, and making the router suspend on an answer it is holding would be
 *   a frame of blank sidebar for no reason.
 *
 * Either way this is a *rendering adapter*, never a permission store. The answer
 * is computed on the server by `resolveStaffPermissions` and re-checked by Hono
 * on every request; a devtools edit here buys a visible button and an API that
 * still refuses it.
 */
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
 * Returns the current admin's raw effective permission set.
 *
 * `React.use` is called conditionally, which is legal and is the reason this
 * reads as one hook rather than two: `use` is explicitly exempt from the rules
 * of hooks and may appear inside a condition. A resolved set is returned
 * directly and nothing suspends; a promise suspends the nearest boundary exactly
 * as it always did.
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
