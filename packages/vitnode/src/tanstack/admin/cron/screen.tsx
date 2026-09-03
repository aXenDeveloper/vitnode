"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
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
      <div className="p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          <CronTableContent data={data} onRun={onRun} />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
