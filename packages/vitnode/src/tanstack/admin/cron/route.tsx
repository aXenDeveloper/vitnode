import type { PluginRouteTranslator } from "@/routing";

import type { CronParams } from "@/views/admin/views/core/advanced/cron/cron-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";
import { cronQuery } from "./query";

export const ADMIN_CRON_NAMESPACES = [
  "admin.advanced.cron",
  "core.global",
] as const;

/** What {@link loadAdminCronRoute} returns, and therefore what `head` receives. */
export interface AdminCronRouteData {
  description: string;
  params: CronParams;
  title: string;
}

const CRON_VIEW_PERMISSION = {
  module: "cron",
  permission: "can_view",
} as const;

export const loadAdminCronRoute = async ({
  adminAccess,
  params,
  queryClient,
  t,
}: AdminScreenContext & {
  params: CronParams;
  t: PluginRouteTranslator;
}): Promise<AdminCronRouteData> => {
  requireAdminPermission(adminAccess, CRON_VIEW_PERMISSION);

  await queryClient.query({
    ...cronQuery({ params }),
    staleTime: "static",
  });

  return {
    description: t("admin.advanced.cron.desc"),
    params,
    title: t("admin.advanced.cron.title"),
  };
};
