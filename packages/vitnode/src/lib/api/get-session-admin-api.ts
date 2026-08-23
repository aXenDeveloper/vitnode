import { headers } from "next/headers";
import { cache } from "react";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/config";
import { getAdminSignInHref } from "@/lib/admin-redirect";
import { fetcher } from "@/lib/fetcher";
import { VITNODE_PATHNAME_HEADER } from "@/lib/request-pathname";

import { redirect } from "../navigation";

/**
 * The signed-in admin and their effective permission set.
 *
 * Memoised with React's `cache()` for the duration of one render pass. This is
 * the single hottest read in the AdminCP: {@link checkAdminPermissionApi} is
 * called from roughly a hundred places - every view that gates a button, and
 * `getSearchNavItems` once per navigation entry - and each call used to be its
 * own HTTP request for the same answer. One render pass now makes one.
 *
 * Deliberately *not* a Next cache. A permission set is per-admin and is
 * revoked, not expired: the API re-checks admin status against the database on
 * every request precisely so that removing someone takes effect immediately,
 * and a stored entry keyed by their session cookie would undo that. The
 * database work behind it is cached instead - short-lived, in Redis, and
 * dropped the moment a role or a staff entry changes.
 */
export const getSessionAdminApi = cache(async () => {
  const res = await fetcher(adminModule, {
    path: "/session",
    method: "get",
    module: "admin",
  });

  if (res.status !== 200) {
    // Remembered as `?redirect=`, so signing back in returns the admin to the
    // page they were on instead of dropping them on the dashboard.
    const pathname = (await headers()).get(VITNODE_PATHNAME_HEADER);
    await redirect(getAdminSignInHref(pathname));

    return;
  }

  const data = await res.json();

  return data;
});

export const checkAdminPermissionApi = async ({
  plugin = CONFIG_PLUGIN.pluginId,
  module,
  permission,
}: Omit<PermissionsStaffArgs, "plugin"> & {
  plugin?: string;
}): Promise<boolean> => {
  const session = await getSessionAdminApi();
  if (!session) return false;

  return hasStaffPermission(session.permissions, {
    plugin,
    module,
    permission,
  });
};
