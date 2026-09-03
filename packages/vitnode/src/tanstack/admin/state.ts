import type { QueryClient } from "@tanstack/react-query";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  EMPTY_STAFF_PERMISSION_SET,
  hasStaffPermission,
} from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";

export const ADMIN_SESSION_QUERY_KEY = ["vitnode", "admin-session"] as const;

export const ADMIN_ENTRY_PATH = "/admin";

/** The AdminCP's landing page - where a finished sign-in goes by default. */
export const ADMIN_HOME_PATH = "/admin/core";

/** The search parameter carrying where a blocked admin was heading. */
export const ADMIN_RETURN_TO_PARAM = "returnTo";

export type AdminAccess<TSession> =
  AdminSessionDenied | AdminSessionGranted<TSession>;

/** The API answered `200`: this browser holds an admin session. */
export interface AdminSessionGranted<TSession> {
  session: TSession;
  status: "granted";
}

/** The API answered `403`: this browser holds no admin session. */
export interface AdminSessionDenied {
  status: "denied";
}

export type AdminSessionFailure =
  { httpStatus?: number; status: "api_error" } | { status: "network_error" };

/** Everything a read of the admin session endpoint can produce. */
export type AdminSessionRead<TSession> =
  AdminAccess<TSession> | AdminSessionFailure;

/** Whether a read produced a decision rather than a failure. */
export const isAdminAccess = <TSession>(
  read: AdminSessionRead<TSession>,
): read is AdminAccess<TSession> =>
  read.status === "granted" || read.status === "denied";

export const adminSessionFailureFromStatus = (
  status: number,
): AdminSessionDenied | AdminSessionFailure =>
  status === 403
    ? { status: "denied" }
    : { httpStatus: status, status: "api_error" };

export const adminSessionReadFromStatus = <TSession>(
  status: number,
  session?: TSession,
): AdminSessionRead<TSession> => {
  if (status === 200) {
    return session === undefined
      ? { httpStatus: status, status: "api_error" }
      : { session, status: "granted" };
  }

  return adminSessionFailureFromStatus(status);
};

export const adminSessionFailureFromError = (
  error: unknown,
): AdminSessionFailure =>
  error instanceof TypeError
    ? { status: "network_error" }
    : { status: "api_error" };

export const ADMIN_SESSION_UNAVAILABLE =
  "The admin session could not be read. This is not a permission decision - try again.";

export class AdminSessionUnavailableError extends Error {
  constructor(failure: AdminSessionFailure) {
    super(ADMIN_SESSION_UNAVAILABLE);
    this.name = "AdminSessionUnavailableError";
    this.failure = failure;
  }

  // Assigned in the body rather than declared as a constructor parameter
  // property: the package compiles with `erasableSyntaxOnly`, so every construct
  // that needs TypeScript to emit runtime code is out.
  readonly failure: AdminSessionFailure;
}

/** Whether an admin may enter the AdminCP shell. */
export const canEnterAdmin = <TSession>(
  access: AdminAccess<TSession>,
): boolean => access.status === "granted";

export const adminPermissionsOf = <TSession extends { permissions: unknown }>(
  access: AdminAccess<TSession>,
): StaffPermissionSet =>
  access.status === "granted"
    ? (access.session.permissions as StaffPermissionSet)
    : EMPTY_STAFF_PERMISSION_SET;

export const hasAdminPermission = <TSession extends { permissions: unknown }>(
  access: AdminAccess<TSession>,
  {
    module,
    permission,
    plugin = CONFIG_PLUGIN.pluginId,
  }: Omit<PermissionsStaffArgs, "plugin"> & { plugin?: string },
): boolean =>
  hasStaffPermission(adminPermissionsOf(access), {
    module,
    permission,
    plugin,
  });

export const removeAdminSession = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
};
