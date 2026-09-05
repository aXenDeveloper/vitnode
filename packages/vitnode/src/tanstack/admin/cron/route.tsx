import { createTranslator } from "use-intl";

import type { CronParams } from "@/views/admin/views/core/advanced/cron/cron-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
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
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: CronParams;
}): Promise<AdminCronRouteData> => {
  requireAdminPermission(adminAccess, CRON_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_CRON_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...cronQuery({ params }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { advanced: { cron: { desc: string; title: string } } };
    },
    namespace: "admin.advanced.cron",
  });

  return { description: t("desc"), params, title: t("title") };
};
