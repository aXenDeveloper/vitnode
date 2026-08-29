import { getTranslations } from "next-intl/server";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { getVitNodeConfig } from "@/vitnode.config";

import type { DashboardWidgetTranslator } from "./resolve-widgets";
import type { ResolvedDashboardWidget } from "./types";

import { coreDashboardWidgets } from "./registry";
import {
  dashboardWidgetSources,
  resolveDashboardWidgets,
} from "./resolve-widgets";

/**
 * The Next.js half: read the config and the admin session, then apply the shared
 * rules.
 *
 * The rules themselves are `resolveDashboardWidgets`', which is pure - so this
 * function is now the two request-scoped reads and nothing else.
 */
export const getDashboardWidgets = async ({
  vitNodeConfig = getVitNodeConfig(),
}: {
  vitNodeConfig?: VitNodeConfig;
} = {}): Promise<ResolvedDashboardWidget[]> => {
  const t = (await getTranslations()) as unknown as DashboardWidgetTranslator;
  const session = await getSessionAdminApi();
  const permissions: StaffPermissionSet = session?.permissions ?? {
    root: false,
    permissions: [],
  };

  return resolveDashboardWidgets({
    permissions,
    sources: dashboardWidgetSources({
      coreTitle: t("admin.global.nav.core"),
      coreWidgets: coreDashboardWidgets,
      plugins: vitNodeConfig.plugins,
      pluginTitle: pluginId =>
        t.has(`${pluginId}.title`) ? t(`${pluginId}.title`) : pluginId,
    }),
    t,
  });
};
