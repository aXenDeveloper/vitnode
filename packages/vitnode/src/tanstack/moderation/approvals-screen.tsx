import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { ModcpApprovalsContent } from "@/views/moderation/modcp/approvals/approvals-content";

import type { ModcpApprovalsRouteSearch } from "./approvals-route-search";
import type { ModcpRouteData } from "./route";

import { RouteMessages } from "../i18n/route-messages";
import {
  modcpApprovalsFilter,
  modcpApprovalsSearchFrom,
  modcpApprovalsSearchParams,
} from "./approvals-route-search";
import { MODCP_NAMESPACES } from "./namespaces";

export const ModcpApprovalsRouteContent = ({
  description,
  navigate,
  search,
  title,
}: ModcpRouteData & {
  navigate: (options: {
    resetScroll?: boolean;
    search: ModcpApprovalsRouteSearch;
  }) => Promise<void>;
  search: ModcpApprovalsRouteSearch;
}) => {
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: modcpApprovalsSearchFrom(nextSearch),
        });
      },
      searchParams: modcpApprovalsSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={MODCP_NAMESPACES}>
      <DataTableNavigationProvider value={navigation}>
        <ModcpApprovalsContent
          description={description}
          filter={modcpApprovalsFilter(search)}
          title={title}
        />
      </DataTableNavigationProvider>
    </RouteMessages>
  );
};
