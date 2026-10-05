import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { cronHealthQueryOptions } from "@/views/admin/views/core/advanced/cron/cron-query";
import { CronSchedulerStatus } from "@/views/admin/views/core/advanced/cron/cron-scheduler-status";
import { CronTableContent } from "@/views/admin/views/core/advanced/cron/cron-table-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminCronRouteData } from "./route";
import type { CronRouteSearch, UncheckedCronSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { cronQuery, useCronRunCallback } from "./query";
import { ADMIN_CRON_NAMESPACES } from "./route";
import { cronSearchFrom, cronSearchParams } from "./route-search";

export interface AdminCronRouteProps extends AdminCronRouteData {
  navigate: AdminTableNavigate<CronRouteSearch>;
  search: UncheckedCronSearch;
}

export const AdminCronRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminCronRouteProps) => {
  const { data } = useSuspenseQuery(cronQuery({ params }));
  const { data: health } = useSuspenseQuery(cronHealthQueryOptions());
  const onRun = useCronRunCallback();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: cronSearchFrom(nextSearch),
        });
      },
      searchParams: cronSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_CRON_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title} />

        <div className="flex flex-col gap-4">
          <CronSchedulerStatus health={health} />

          <DataTableNavigationProvider value={navigation}>
            <CronTableContent data={data} onRun={onRun} />
          </DataTableNavigationProvider>
        </div>
      </div>
    </RouteMessages>
  );
};
