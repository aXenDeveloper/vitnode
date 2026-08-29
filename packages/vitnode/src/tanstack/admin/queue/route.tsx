"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { QueueParams } from "@/views/admin/views/core/advanced/queue/queue-query";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { QueueTableContent } from "@/views/admin/views/core/advanced/queue/queue-table-content";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type { QueueRouteSearch, UncheckedQueueSearch } from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { requireAdminPermission } from "../screen";
import { queueQuery } from "./query";
import { queueSearchFrom, queueSearchParams } from "./route-search";

/**
 * `/admin/core/advanced/queue`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.advanced.queue` is the heading, the columns, the status badges and the
 * filter's labels; `core.global` is the rest of the table. The same set the
 * Next.js page's `<I18nProvider namespaces={["admin.advanced.queue"]}>` provides,
 * which always adds `core.global` itself.
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

/**
 * The tuple `<AdminPermissionRequired module="queue" permission="can_view">`
 * states in the Next.js page, and the one `getQueueTasksRoute` declares as its
 * `adminStaffPermission`.
 */
const QUEUE_VIEW_PERMISSION = {
  module: "queue",
  permission: "can_view",
} as const;

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * screen never sends a request the API is going to refuse. A refusal from the
 * queue API is left to propagate: an empty table is indistinguishable from an
 * installation with nothing queued, which is the one thing an operational screen
 * must never look like.
 */
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
    queryClient.ensureQueryData(queueQuery({ params })),
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

export interface AdminQueueRouteProps extends AdminQueueRouteData {
  navigate: AdminTableNavigate<QueueRouteSearch>;
  search: UncheckedQueueSearch;
}

/**
 * `/admin/core/advanced/queue`, as everything below a route file's `component`.
 *
 * `navigate` and `search` come from the host because TanStack infers both from
 * the `createFileRoute` path. The status filter travels the same seam as the
 * sort headers and the pager: it rewrites a query string, and the route turns
 * that back into validated search.
 */
export const AdminQueueRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminQueueRouteProps) => {
  const { data } = useSuspenseQuery(queueQuery({ params }));

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: queueSearchFrom(nextSearch),
        });
      },
      searchParams: queueSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_QUEUE_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          <QueueTableContent data={data} />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
