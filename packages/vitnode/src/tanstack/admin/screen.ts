import { notFound } from "@tanstack/react-router";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import type { AdminLoaderContext } from "./intl";
import type { AdminAccessState } from "./session-api";

import { hasAdminPermission } from "./state";

/** The loader context of a route inside the AdminCP shell. */
export interface AdminScreenContext extends AdminLoaderContext {
  adminAccess: AdminAccessState;
}

/**
 * Stops an AdminCP route's loader unless the admin holds the permission, so the
 * screen renders the not-found page instead. `plugin` defaults to
 * `@vitnode/core`. Pair it with the API route's own `adminStaffPermission`.
 *
 * @throws TanStack Router's `notFound()` without the permission.
 */
export const requireAdminPermission = (
  access: AdminAccessState,
  args: Omit<PermissionsStaffArgs, "plugin"> & { plugin?: string },
): void => {
  if (hasAdminPermission(access, args)) return;

  // TanStack Router's own control-flow signal - a typed value the router catches
  // and turns into the nearest `notFoundComponent`. Throwing it is what stops
  // the loader.
  // oxlint-disable-next-line typescript/only-throw-error
  throw notFound();
};
