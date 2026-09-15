import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { normalizeAdminUserId } from "@/views/admin/views/core/users/detail/user-query";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminUserQuery } from "./query";

export const ADMIN_USER_NAMESPACES = [
  "admin.user",
  "core.global",
  "core.search",
] as const;

/** What {@link loadAdminUserRoute} returns, and therefore what `head` receives. */
export interface AdminUserRouteData {
  adminUserId: AdminIdentity;
  id: string;
  locale: string;
  title: string;
}

export const loadAdminUserRoute = async ({
  adminAccess,
  id: raw,
  locale,
  queryClient,
  t,
}: AdminScreenContext & {
  /** The `$id` segment, exactly as it was typed. Nothing has checked it yet. */
  id: string;
  t: PluginRouteTranslator;
}): Promise<AdminUserRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_USER_PERMISSIONS.view);

  const id = normalizeAdminUserId(raw);
  if (id === null) {
    // TanStack Router's own control-flow signal.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const adminUserId = adminIdentityOf(adminAccess);

  const user = await queryClient.query({
    ...adminUserQuery({ adminUserId, id }),
    staleTime: "static",
  });

  return {
    adminUserId,
    id,
    locale,
    title: `${user.name} - ${t("admin.user.show.title")}`,
  };
};
