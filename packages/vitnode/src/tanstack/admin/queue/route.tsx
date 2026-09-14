import type { PluginRouteTranslator } from "@/routing";

import type { QueueParams } from "@/views/admin/views/core/advanced/queue/queue-query";

import type { AdminScreenContext } from "../screen";

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
  params,
  queryClient,
  t,
}: AdminScreenContext & {
  params: QueueParams;
  t: PluginRouteTranslator;
}): Promise<AdminQueueRouteData> => {
  requireAdminPermission(adminAccess, QUEUE_VIEW_PERMISSION);

  await queryClient.query({
    ...queueQuery({ params }),
    staleTime: "static",
  });

  return {
    description: t("admin.advanced.queue.desc"),
    params,
    title: t("admin.advanced.queue.title"),
  };
};
