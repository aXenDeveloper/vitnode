import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { dashboardLayoutQuery } from "./query";

/**
 * `/admin/core` - the AdminCP dashboard, as everything a TanStack Start route
 * needs and nothing a route owns.
 */

export const ADMIN_DASHBOARD_NAMESPACES = [
  "admin.dashboard",
  "admin.global",
  "core.global",
] as const;

export interface AdminDashboardRouteData {
  /** The running VitNode version, or `undefined` outside a granted session. */
  vitnodeVersion?: string;
}

/** The dashboard route's loader: warms its messages and the admin's saved layout, and returns the running version. */
export const loadAdminDashboardRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminDashboardRouteData> => {
  const adminUserId = adminIdentityOf(adminAccess);

  await Promise.all([
    queryClient.query({
      ...intlQueryOptions({ locale, namespaces: ADMIN_DASHBOARD_NAMESPACES }),
      staleTime: "static",
    }),
    queryClient.query({
      ...dashboardLayoutQuery(adminUserId),
      staleTime: "static",
    }),
  ]);

  return {
    vitnodeVersion:
      adminAccess.status === "granted"
        ? adminAccess.session.vitnode_version
        : undefined,
  };
};

/** A plugin's widgets, as a browser-side registry carries them. */
