import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { ModcpReportsContent } from "@/views/moderation/modcp/reports-content";

import type { ModcpReportsRouteData } from "./route";
import type { ModcpReportsRouteSearch } from "./route-search";

import { RouteMessages } from "../i18n/route-messages";
import { MODCP_NAMESPACES } from "./namespaces";
import {
  modcpBoardFilter,
  modcpReportsSearchFrom,
  modcpReportsSearchParams,
} from "./route-search";

export const ModcpReportsRouteContent = ({
  description,
  me,
  navigate,
  search,
  title,
}: ModcpReportsRouteData & {
  navigate: (options: {
    resetScroll?: boolean;
    search: ModcpReportsRouteSearch;
  }) => Promise<void>;
  search: ModcpReportsRouteSearch;
}) => {
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: modcpReportsSearchFrom(nextSearch),
        });
      },
      searchParams: modcpReportsSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={MODCP_NAMESPACES}>
      <DataTableNavigationProvider value={navigation}>
        <ModcpReportsContent
          description={description}
          filter={modcpBoardFilter(search)}
          me={me}
          title={title}
        />
      </DataTableNavigationProvider>
    </RouteMessages>
  );
};
