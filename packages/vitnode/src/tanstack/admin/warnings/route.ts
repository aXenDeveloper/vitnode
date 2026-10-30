import type { PluginRouteTranslator } from "@/routing";

import {
  adminWarningReasonsQueryOptions,
  adminWarningThresholdsQueryOptions,
} from "@/views/admin/views/core/moderation/warnings/warnings-admin-api";
import { ADMIN_WARNING_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";

export const ADMIN_WARNINGS_NAMESPACES = [
  "admin.moderation.warning_reasons",
  "admin.moderation.warning_thresholds",
  "core.global",
  "core.moderation",
] as const;

export interface AdminWarningsRouteData {
  description: string;
  title: string;
}

export const loadAdminWarningReasonsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminWarningsRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_WARNING_PERMISSIONS.view);
  await queryClient.query({
    ...adminWarningReasonsQueryOptions(adminIdentityOf(adminAccess)),
    staleTime: "static",
  });

  return {
    description: t("admin.moderation.warning_reasons.desc"),
    title: t("admin.moderation.warning_reasons.title"),
  };
};

export const loadAdminWarningThresholdsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminWarningsRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_WARNING_PERMISSIONS.view);
  await queryClient.query({
    ...adminWarningThresholdsQueryOptions(adminIdentityOf(adminAccess)),
    staleTime: "static",
  });

  return {
    description: t("admin.moderation.warning_thresholds.desc"),
    title: t("admin.moderation.warning_thresholds.title"),
  };
};
