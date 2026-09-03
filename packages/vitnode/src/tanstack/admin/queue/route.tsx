import { createTranslator } from "use-intl";

import type { QueueParams } from "@/views/admin/views/core/advanced/queue/queue-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { queueQuery } from "./query";

/**
 * `/admin/core/advanced/queue`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

export const ADMIN_QUEUE_NAMESPACES = [
  "admin.advanced.queue",
  "core.global",
] as const;

/** What {@link loadAdminQueueRoute} returns, and therefore what `head` receives. */
export interface AdminQueueRouteData {
  description: string;
  params: QueueParams;
  title: string;
}

const QUEUE_VIEW_PERMISSION = {
  module: "queue",
  permission: "can_view",
} as const;

export const loadAdminQueueRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: QueueParams;
}): Promise<AdminQueueRouteData> => {
  requireAdminPermission(adminAccess, QUEUE_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_QUEUE_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...queueQuery({ params }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { advanced: { queue: { desc: string; title: string } } };
    },
    namespace: "admin.advanced.queue",
  });

  return { description: t("desc"), params, title: t("title") };
};
