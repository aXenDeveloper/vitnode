import type { PluginRouteTranslator } from "@/routing";

import { adminReactionsQueryOptions } from "@/views/admin/views/core/reactions/reactions-query";
import { ADMIN_REACTION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";

export const ADMIN_REACTIONS_NAMESPACES = [
  "admin.reactions",
  "core.global",
  "core.reactions",
] as const;

export interface AdminReactionsRouteData {
  description: string;
  title: string;
}

export const loadAdminReactionsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminReactionsRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_REACTION_PERMISSIONS.view);

  await queryClient.query({
    ...adminReactionsQueryOptions(adminIdentityOf(adminAccess)),
    staleTime: "static",
  });

  return {
    description: t("admin.reactions.desc"),
    title: t("admin.reactions.title"),
  };
};
