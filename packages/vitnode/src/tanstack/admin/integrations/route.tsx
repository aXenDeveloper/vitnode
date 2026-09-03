import { createTranslator } from "use-intl";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
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
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminIntegrationsRouteData> => {
  requireAdminPermission(adminAccess, SYSTEM_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_INTEGRATIONS_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...integrationsQuery(),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { system: { integrations: { desc: string; title: string } } };
    },
    namespace: "admin.system.integrations",
  });

  return { description: t("desc"), title: t("title") };
};
