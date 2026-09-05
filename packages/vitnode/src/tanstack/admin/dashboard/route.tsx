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

export const loadAdminDashboardRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminDashboardRouteData> => {
  const adminUserId = adminIdentityOf(adminAccess);

  await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_DASHBOARD_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...dashboardLayoutQuery(adminUserId),
      revalidateIfStale: true,
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
