import { notFound } from "@tanstack/react-router";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import type { AdminLoaderContext } from "./intl";
import type { AdminAccessState } from "./session-api";

import { hasAdminPermission } from "./state";

export interface AdminScreenContext extends AdminLoaderContext {
  adminAccess: AdminAccessState;
}

export const requireAdminPermission = (
  access: AdminAccessState,
  args: Omit<PermissionsStaffArgs, "plugin"> & { plugin?: string },
): void => {
  if (hasAdminPermission(access, args)) return;

  // TanStack Router's own control-flow signal - a typed value the router catches
  // and turns into the nearest `notFoundComponent`. Throwing it is what stops
  // the loader.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw notFound();
};
