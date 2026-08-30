"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { QueueTableContent } from "@/views/admin/views/core/advanced/queue/queue-table-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminQueueRouteData } from "./route";
import type { QueueRouteSearch, UncheckedQueueSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { queueQuery } from "./query";
import { ADMIN_QUEUE_NAMESPACES } from "./route";
import { queueSearchFrom, queueSearchParams } from "./route-search";

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
