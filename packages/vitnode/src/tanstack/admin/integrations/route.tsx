import type { PluginRouteTranslator } from "@/routing";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";
import { integrationsQuery } from "./query";

/**
 * `/admin/core/system/integrations`, as everything a TanStack Start route needs
 * and nothing a route owns.
 */

export const ADMIN_INTEGRATIONS_NAMESPACES = [
  "admin.system.integrations",
  "core.global",
] as const;

/** What {@link loadAdminIntegrationsRoute} returns - and what `head` receives. */
export interface AdminIntegrationsRouteData {
  description: string;
  title: string;
}

/** The core plugin's `system` module, which all four tuples on this screen use. */
export const SYSTEM_MODULE = "system";

const SYSTEM_VIEW_PERMISSION = {
  module: SYSTEM_MODULE,
  permission: "can_view",
} as const;

export const loadAdminIntegrationsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminIntegrationsRouteData> => {
  requireAdminPermission(adminAccess, SYSTEM_VIEW_PERMISSION);

  await queryClient.query({
    ...integrationsQuery(),
    staleTime: "static",
  });

  return {
    description: t("admin.system.integrations.desc"),
    title: t("admin.system.integrations.title"),
  };
};
