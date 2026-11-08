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
  "admin.moderation.warnings",
  "admin.moderation.warning_reasons",
  "admin.moderation.warning_thresholds",
  "core.global",
  "core.moderation",
] as const;

export const ADMIN_WARNINGS_PATH = "/admin/core/moderation/warnings";

export const ADMIN_WARNINGS_TAB_PATHS = {
  reasons: ADMIN_WARNINGS_PATH,
  thresholds: `${ADMIN_WARNINGS_PATH}/actions`,
} as const;

export type AdminWarningsTab = keyof typeof ADMIN_WARNINGS_TAB_PATHS;

export const adminWarningsTabFromPath = (pathname: string): AdminWarningsTab =>
  pathname.replace(/\/+$/, "").endsWith("/actions") ? "thresholds" : "reasons";

export interface AdminWarningsRouteData {
  description: string;
  title: string;
}

type AdminWarningsLoadArgs = AdminScreenContext & {
  t: PluginRouteTranslator;
};

export const loadAdminWarningsLayout = async ({
  adminAccess,
  queryClient,
  t,
}: AdminWarningsLoadArgs): Promise<AdminWarningsRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_WARNING_PERMISSIONS.view);
  const adminUserId = adminIdentityOf(adminAccess);
  await Promise.all([
    queryClient.query({
      ...adminWarningReasonsQueryOptions(adminUserId),
      staleTime: "static",
    }),
    queryClient.query({
      ...adminWarningThresholdsQueryOptions(adminUserId),
      staleTime: "static",
    }),
  ]);

  return {
    description: t("admin.moderation.warnings.desc"),
    title: t("admin.moderation.warnings.title"),
  };
};

export const loadAdminWarningReasonsTab = async ({
  adminAccess,
  queryClient,
}: AdminScreenContext): Promise<undefined> => {
  requireAdminPermission(adminAccess, ADMIN_WARNING_PERMISSIONS.view);
  await queryClient.query({
    ...adminWarningReasonsQueryOptions(adminIdentityOf(adminAccess)),
    staleTime: "static",
  });
};

export const loadAdminWarningThresholdsTab = async ({
  adminAccess,
  queryClient,
}: AdminScreenContext): Promise<undefined> => {
  requireAdminPermission(adminAccess, ADMIN_WARNING_PERMISSIONS.view);
  await queryClient.query({
    ...adminWarningThresholdsQueryOptions(adminIdentityOf(adminAccess)),
    staleTime: "static",
  });
};
