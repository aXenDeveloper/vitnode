import type { PluginRouteTranslator } from "@/routing";

import { ADMIN_REPORT_REASON_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminReportReasonsQuery } from "./query";

export const ADMIN_REPORT_REASONS_NAMESPACES = [
  "admin.moderation.report_reasons",
  "core.global",
] as const;

export interface AdminReportReasonsRouteData {
  description: string;
  title: string;
}

export const loadAdminReportReasonsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminReportReasonsRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_REPORT_REASON_PERMISSIONS.view);

  await queryClient.query({
    ...adminReportReasonsQuery(adminIdentityOf(adminAccess)),
    staleTime: "static",
  });

  return {
    description: t("admin.moderation.report_reasons.desc"),
    title: t("admin.moderation.report_reasons.title"),
  };
};
