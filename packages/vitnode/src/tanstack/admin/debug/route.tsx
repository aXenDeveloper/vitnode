import { createTranslator } from "use-intl";

import type { DebugLogsParams } from "@/views/admin/views/core/debug/debug-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { debugLogsQuery, debugQueueQuery } from "./query";

/**
 * `/admin/core/debug`, as everything a TanStack Start route needs and nothing a
 * route owns.
 */

export const ADMIN_DEBUG_NAMESPACES = [
  "admin.advanced.queue",
  "admin.debug",
  "core.global",
] as const;

/** What {@link loadAdminDebugRoute} returns, and therefore what `head` receives. */
export interface AdminDebugRouteData {
  description: string;
  logsTitle: string;
  params: DebugLogsParams;
  queueTitle: string;
  title: string;
}

/** The core plugin's `debug` module - both tuples on this screen use it. */
export const DEBUG_MODULE = "debug";

const DEBUG_VIEW_PERMISSION = {
  module: DEBUG_MODULE,
  permission: "can_view",
} as const;

export const loadAdminDebugRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: DebugLogsParams;
}): Promise<AdminDebugRouteData> => {
  requireAdminPermission(adminAccess, DEBUG_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_DEBUG_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...debugQueueQuery(),
      revalidateIfStale: true,
    }),
    queryClient.ensureQueryData({
      ...debugLogsQuery({ params }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: {
        debug: {
          desc: string;
          logs: { title: string };
          queue: { title: string };
          title: string;
        };
      };
    },
    namespace: "admin.debug",
  });

  return {
    description: t("desc"),
    logsTitle: t("logs.title"),
    params,
    queueTitle: t("queue.title"),
    title: t("title"),
  };
};
